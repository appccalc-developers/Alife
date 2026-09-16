using System.Text.Json;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Events;

public sealed class EventCollaborationTests
{
    private static readonly LocalizedTextDto Text = new("Instructions", "说明");

    [Fact]
    public async Task Reports_SeparateAuthorAndOwner_AdoptImmutableContent_AndRevokeAccess()
    {
        await using var f = new Fixture(); await f.Save();
        var service = new EventModuleReportService(f.Db, f.Invalidation);
        Assert.Equal(AppResultStatus.Forbidden, (await service.GetAsync(f.Event.Id,"PROGRAM.PRODUCTION",f.Ordinary,default)).Status);
        Assert.Equal(AppResultStatus.Forbidden, (await service.ActAsync(f.Event.Id,"PROGRAM.PRODUCTION",f.Owner,"save",new(Text),"\"report-new\"","owner-cannot-write",default)).Status);
        var draft = await service.ActAsync(f.Event.Id,"PROGRAM.PRODUCTION",f.Author,"save",new(Text),"\"report-new\"","report-save",default);
        Assert.True(draft.IsSuccess,draft.Message);
        var submitted = await service.ActAsync(f.Event.Id,"PROGRAM.PRODUCTION",f.Author,"submit",new(),draft.Value!.ETag,"report-submit",default);
        Assert.True(submitted.IsSuccess,submitted.Message);
        var review = new EventReportRequest(RevisionId:submitted.Value!.SubmittedRevisionId);
        var adopted = await service.ActAsync(f.Event.Id,"PROGRAM.PRODUCTION",f.Owner,"adopt",review,submitted.Value.ETag,"report-adopt",default);
        Assert.True(adopted.IsSuccess,adopted.Message);
        var contextBefore = await EventPlanContextCapture.CaptureAsync(f.Db,f.Event,default);
        var next = await service.ActAsync(f.Event.Id,"PROGRAM.PRODUCTION",f.Author,"save",new(new("New draft","新草稿")),adopted.Value!.ETag,"report-next",default);
        Assert.True(next.IsSuccess,next.Message);
        Assert.Equal(Text,Assert.Single(next.Value!.Revisions,r => r.Id == next.Value.AdoptedRevisionId).Text);
        Assert.Equal(EventPackageCanonicalizer.HashCanonical(contextBefore),EventPackageCanonicalizer.HashCanonical(await EventPlanContextCapture.CaptureAsync(f.Db,f.Event,default)));
        f.Db.EventRoleAssignments.Single(r => r.MemberId == f.Author).EndedUtc = DateTime.UtcNow; await f.Save();
        Assert.Equal(AppResultStatus.Forbidden,(await service.ActAsync(f.Event.Id,"PROGRAM.PRODUCTION",f.Author,"save",new(Text),next.Value.ETag,"revoked-edit",default)).Status);
    }

    [Fact]
    public async Task HouseholdWaitlist_IsFifo_AndSplittingRequiresOrganiser()
    {
        await using var f = new Fixture(); await f.Save(); await f.Rules(1);
        var family = await f.Create(2); await f.Consent(family); await f.Act(family,"complete");
        Assert.All(family.Participants,p => Assert.Equal("waitlisted",p.SeatStatus));
        var single = await f.Create(1); await f.Consent(single); await f.Act(single,"complete");
        Assert.Equal("waitlisted",single.Participants.Single().SeatStatus);
        var outsiderSplit = await f.Registration.ActAsync(f.Event.Id,family.Id,f.Author,"split",new(AllowSplit:true),EventRegistrationWorkService.ApplicationETag(family),"not-organiser",default);
        Assert.Equal(AppResultStatus.Forbidden,outsiderSplit.Status);
        await f.Act(family,"split",new(AllowSplit:true));
        Assert.Single(family.Participants,p => p.SeatStatus == "confirmed");
        Assert.Equal("waitlisted",single.Participants.Single().SeatStatus);
        Assert.Equal(1,await f.Db.EventRegistrationParticipants.CountAsync(p => p.SeatStatus == "confirmed"));
    }

    [Fact]
    public async Task Invitations_RequireApproval_ReserveActualPeople_ExpireOnce()
    {
        await using var f = new Fixture(); await f.Save(); await f.Rules(2);
        f.Approval.IsRegistrationApprovalCurrentAsync(f.Event.Id,Arg.Any<CancellationToken>()).Returns(false);
        var invitation = await f.Create(2,true);
        Assert.Equal(AppResultStatus.Conflict,(await f.Registration.ActAsync(f.Event.Id,invitation.Id,f.Owner,"send-invitation",new(),EventRegistrationWorkService.ApplicationETag(invitation),"before-approval",default)).Status);
        Assert.All(invitation.Participants,p => Assert.Equal("draft",p.SeatStatus));
        Assert.False(await EventRegistrationMaterialService.CanAccessAsync(f.Db,invitation.Participants.First().Id,f.Ordinary,default));
        f.Approval.IsRegistrationApprovalCurrentAsync(f.Event.Id,Arg.Any<CancellationToken>()).Returns(true);
        await f.Act(invitation,"send-invitation");
        Assert.All(invitation.Participants,p => Assert.Equal("reserved",p.SeatStatus));
        var extra = await f.Create(1,true);
        Assert.Equal(AppResultStatus.Conflict,(await f.Registration.ActAsync(f.Event.Id,extra.Id,f.Owner,"send-invitation",new(),EventRegistrationWorkService.ApplicationETag(extra),"no-room",default)).Status);
        invitation.ReservationExpiresUtc = DateTime.UtcNow.AddSeconds(-1); await f.Save();
        Assert.Equal(AppResultStatus.Conflict,(await f.Registration.ActAsync(f.Event.Id,invitation.Id,f.Owner,"complete",new(),EventRegistrationWorkService.ApplicationETag(invitation),"expired-completion",default)).Status);
        await f.Registration.ExpireDueAsync(default); var notices = await f.Db.NotificationMessages.CountAsync();
        await f.Registration.ExpireDueAsync(default);
        Assert.All(invitation.Participants,p => Assert.Equal("expired",p.SeatStatus));
        Assert.Equal(notices,await f.Db.NotificationMessages.CountAsync());
        Assert.Single(await f.Db.EventRegistrationActions.Where(x => x.Operation == "reservation.expired").ToListAsync());
    }

    [Fact]
    public async Task ProxyEntry_CannotForgeAdultConsent_AndMissingEvidenceBlocksCompletion()
    {
        await using var f = new Fixture(); await f.Save(); await f.Rules(4);
        var app = await f.Create(1);
        var person = app.Participants.Single();
        Assert.Equal(AppResultStatus.Forbidden,(await f.Registration.ActAsync(f.Event.Id,app.Id,f.Owner,"consent",new(ParticipantId:person.Id),EventRegistrationWorkService.ApplicationETag(app),"proxy-consent",default)).Status);
        Assert.Equal(AppResultStatus.Conflict,(await f.Registration.ActAsync(f.Event.Id,app.Id,f.Owner,"complete",new(),EventRegistrationWorkService.ApplicationETag(app),"missing-consent",default)).Status);
        await f.Consent(app); await f.Act(app,"complete");
        Assert.Equal("confirmed",person.SeatStatus); Assert.Equal("selfOffline",person.ConsentMethod);
        Assert.Equal(f.Owner,person.ConsentRecordedByMemberId); Assert.NotEmpty(person.ConsentEvidence);
        Assert.False(await EventRegistrationMaterialService.CanAccessAsync(f.Db,person.Id,f.Ordinary,default));
        Assert.True(await EventRegistrationMaterialService.CanAccessAsync(f.Db,person.Id,f.Owner,default));
    }

    [Fact]
    public async Task LegacyUpgrade_PreservesIdPayloadAndUnprovenConsent()
    {
        await using var f = new Fixture();
        var legacy = new EventEnrollment { Id=Guid.NewGuid(),EventId=f.Event.Id,MemberId=f.Ordinary,Status="confirmed",EnrollmentJson="{\"family\":[1,2,3,4]}",CreatedUtc=DateTime.UtcNow,UpdatedUtc=DateTime.UtcNow };
        f.Db.EventEnrollments.Add(legacy); await f.Save(); await f.Rules(1);
        var imported = Assert.Single(await f.Db.EventRegistrationApplications.Include(x => x.Participants).ToListAsync());
        Assert.Equal(legacy.Id,imported.LegacyEnrollmentId);
        var person = Assert.Single(imported.Participants); Assert.True(person.IsLegacy); Assert.Null(person.ConsentedUtc);
        Assert.Equal(legacy.EnrollmentJson,person.AnswersJson);
        await f.Act(imported,"cancel");
        Assert.Equal("cancelled",legacy.Status); Assert.Equal("{\"family\":[1,2,3,4]}",legacy.EnrollmentJson);
        Assert.Single(await f.Db.EventEnrollmentHistory.Where(x => x.EnrollmentId == legacy.Id).ToListAsync());
    }

    [Fact]
    public async Task FeeApproval_IsIndependent_AndPaymentIsIdempotent()
    {
        await using var f = new Fixture();
        f.Role(f.Author,"MONEY.FINANCE:finance.owner"); f.Role(f.Ordinary,"MONEY.FINANCE:finance.approver"); await f.Save();
        var rules = f.DefaultRules(2) with { FeeMinor=1200,PaymentInstructions=Text,RefundTerms=Text,MoneyFlowScope="registrationFeesOnly" };
        var policy = await f.Registration.SaveRulesAsync(f.Event.Id,f.Owner,rules,"\"registration-new\"",default); Assert.True(policy.IsSuccess,policy.Message);
        var submitted = await f.Registration.FeesAsync(f.Event.Id,f.Author,"submit",null,policy.Value!.ETag,"fees-submit",default); Assert.True(submitted.IsSuccess,submitted.Message);
        Assert.Equal(AppResultStatus.Forbidden,(await f.Registration.FeesAsync(f.Event.Id,f.Author,"approve",null,submitted.Value!.ETag,"fees-self",default)).Status);
        var approved = await f.Registration.FeesAsync(f.Event.Id,f.Ordinary,"approve",null,submitted.Value.ETag,"fees-approve",default); Assert.True(approved.IsSuccess,approved.Message);
        var app = await f.Create(1); await f.Consent(app); var person=app.Participants.Single();
        var duties = new EventDutyProjectionService(f.Db,f.Approval);
        Assert.Contains(await duties.ListAsync(f.Author,default),d => d.Task.ActionType == "event.registration.payment");
        Assert.Equal(AppResultStatus.Conflict,(await f.Registration.ActAsync(f.Event.Id,app.Id,f.Owner,"complete",new(),EventRegistrationWorkService.ApplicationETag(app),"unpaid",default)).Status);
        var request = new RegistrationActionRequest(ParticipantId:person.Id,AmountMinor:1200,Evidence:"Verified bank receipt 17"); var tag=EventRegistrationWorkService.ApplicationETag(app);
        Assert.True((await f.Registration.ActAsync(f.Event.Id,app.Id,f.Author,"payment",request,tag,"receipt-17",default)).IsSuccess);
        Assert.True((await f.Registration.ActAsync(f.Event.Id,app.Id,f.Author,"payment",request,tag,"receipt-17",default)).IsSuccess);
        Assert.Equal(1200,person.PaidMinor); Assert.Single(await f.Db.EventRegistrationActions.Where(x => x.Operation=="payment").ToListAsync());
        Assert.DoesNotContain(await duties.ListAsync(f.Author,default),d => d.Task.ActionType == "event.registration.payment");
        await f.Act(app,"complete"); Assert.Equal("confirmed",person.SeatStatus);
    }

    [Fact]
    public async Task PlanContext_ContainsAdoptedPlanningFields_ExcludesEmbeddedPrivateData()
    {
        await using var f = new Fixture(); f.Event.EventDataJson="{\"description\":{\"en\":\"Plan\",\"zh\":\"方案\"},\"ram\":{\"health\":\"private\"},\"participants\":[\"private\"],\"uploads\":[\"private\"]}"; await f.Save();
        var occurrence = new EventOccurrence { Id=Guid.NewGuid(),EventId=f.Event.Id,StartUtc=f.Event.StartDate,EndUtc=f.Event.EndDate };
        var session = new EventSession { Id=Guid.NewGuid(),OccurrenceId=occurrence.Id,TitleEn="Programme",TitleZh="节目",StartUtc=f.Event.StartDate,EndUtc=f.Event.EndDate };
        session.ProgramItems.Add(new() { Id=Guid.NewGuid(),SessionId=session.Id,TitleEn="Welcome",TitleZh="欢迎",DurationMinutes=10,ContentJson="{\"url\":\"program-private-url\"}" });
        f.Db.EventOccurrences.Add(occurrence); f.Db.EventSessions.Add(session); await f.Save();
        var context = await EventPlanContextCapture.CaptureAsync(f.Db,f.Event,default);
        Assert.Equal("Welcome",Assert.Single(Assert.Single(context.Programme).Items).Title.En);
        Assert.DoesNotContain("program-private-url",JsonSerializer.Serialize(context));
        Assert.True(context.Details!.Value.TryGetProperty("description",out _));
        Assert.False(context.Details.Value.TryGetProperty("ram",out _)); Assert.False(context.Details.Value.TryGetProperty("participants",out _));
        var ram = new EventRamGovernanceService(f.Db,f.Authorization,Substitute.For<IEventCacheInvalidationService>(),f.Invalidation);
        Assert.False((await ram.GetAsync(f.Event.Id,f.Owner,default)).Value!.CanEdit);
    }

    [Fact]
    public async Task RevokedOwner_CannotUseLegacyPlanManagementAuthority()
    {
        await using var f = new Fixture(); await f.Save();
        Assert.True(await EventCompositionPersistence.CanManageEventAsync(f.Db,f.Authorization,f.Event,f.Owner,default));
        f.Db.GroupMemberships.Remove(await f.Db.GroupMemberships.SingleAsync(x => x.MemberId == f.Owner)); await f.Save();
        Assert.False(await EventCompositionPersistence.CanManageEventAsync(f.Db,f.Authorization,f.Event,f.Owner,default));
        Assert.False(await EventWorkAccess.PlanReaderAsync(f.Db,f.Event,f.Owner,default));
        f.Event.CollaborationVersion = 0;
        Assert.False(await EventCompositionPersistence.CanAuthorRamAsync(f.Db,f.Event,f.Owner,default));
    }

    [Fact]
    public async Task PersistentWork_IsRoleScoped_AndSurvivesCompletedReportDuty()
    {
        await using var f = new Fixture(); await f.Save();
        var duties = new EventDutyProjectionService(f.Db,f.Approval); var work = new EventWorkService(f.Db,duties);
        var author = await work.GetAsync(f.Event.Id,f.Author,1,default); Assert.True(author.IsSuccess,author.Message);
        Assert.NotNull(author.Value!.PlanContext); Assert.Null(author.Value.PreparationProgress);
        Assert.Contains(author.Value.Links,x => x.Key == "report:PROGRAM.PRODUCTION" && x.CanEdit);
        Assert.DoesNotContain(author.Value.Links,x => x.Key == "preparation");
        Assert.Equal(AppResultStatus.Forbidden,(await work.GetAsync(f.Event.Id,f.Ordinary,1,default)).Status);
        Assert.NotNull((await work.GetAsync(f.Event.Id,f.Owner,1,default)).Value!.PreparationProgress);
        var reports = new EventModuleReportService(f.Db,f.Invalidation);
        var saved = await reports.ActAsync(f.Event.Id,"PROGRAM.PRODUCTION",f.Author,"save",new(Text),"\"report-new\"","work-save",default);
        var submitted = await reports.ActAsync(f.Event.Id,"PROGRAM.PRODUCTION",f.Author,"submit",new(),saved.Value!.ETag,"work-submit",default);
        var adopted = await reports.ActAsync(f.Event.Id,"PROGRAM.PRODUCTION",f.Owner,"adopt",new(RevisionId:submitted.Value!.SubmittedRevisionId),submitted.Value.ETag,"work-adopt",default);
        Assert.True(adopted.IsSuccess,adopted.Message);
        Assert.DoesNotContain(await duties.ListAsync(f.Author,default),x => x.Task.SourceType == "moduleReport");
        Assert.Contains((await work.ListAsync(f.Author,1,null,default)).Items,x => x.EventId == f.Event.Id);
        f.Db.EventRoleAssignments.Single(x => x.MemberId == f.Author).EndedUtc = DateTime.UtcNow; await f.Save();
        Assert.Empty((await work.ListAsync(f.Author,1,null,default)).Items);
        Assert.Equal(AppResultStatus.Forbidden,(await work.GetAsync(f.Event.Id,f.Author,1,default)).Status);
    }

    [Fact]
    public async Task PublishedRosterWork_SeparatesOwnerPreparationFromCoordinatorScheduling()
    {
        await using var f = new Fixture(rosterEnabled: true);
        f.Role(f.Ordinary, "SERVICE.ROSTER:roster.coordinator"); await f.Save();
        var work = new EventWorkService(f.Db, new EventDutyProjectionService(f.Db, f.Approval));
        var owner = (await work.GetAsync(f.Event.Id, f.Owner, 1, default)).Value!;
        Assert.Contains(owner.Links, x => x.Key == "preparation" && x.Stage == "preparation");
        Assert.Contains(owner.Links, x => x.Key == "published-event" && x.Stage == "registration");
        Assert.DoesNotContain(owner.Links, x => x.Key.StartsWith("roster:"));
        var coordinator = (await work.GetAsync(f.Event.Id, f.Ordinary, 1, default)).Value!;
        Assert.DoesNotContain(coordinator.Links, x => x.Key == "preparation");
        Assert.Contains(coordinator.Links, x => x.Key == "roster:published" && x.Stage == "registration" && x.CanEdit);
        Assert.Contains(coordinator.Links, x => x.Key == "published-event" && x.Url.Contains($"/groups/{f.Event.GroupId}/events/{f.Event.Id}"));
        f.Event.PublicationStatus = EventPublicationStatus.Draft; await f.Save();
        var beforePublication = (await work.GetAsync(f.Event.Id, f.Ordinary, 1, default)).Value!;
        Assert.DoesNotContain(beforePublication.Links, x => x.Key.StartsWith("roster:") || x.Key == "published-event");
    }

    [Fact]
    public async Task StandingVenueCalendar_HidesPrivateTitles_ReleasesOneDate_RefusesConflictingRestore()
    {
        await using var f = new Fixture(); f.Event.PublicationStatus = EventPublicationStatus.Draft;
        var venue = new EventVenue { Id = Guid.NewGuid(), ManagingGroupId = f.Event.GroupId, NameEn = "Main hall", NameZh = "主堂", Capacity = 100, TimeZone = "Australia/Perth", CreatedByMemberId = f.Owner };
        f.Db.EventVenues.Add(venue); await f.Save();
        var service = new EventVenueCalendarService(f.Db,f.Authorization,f.Invalidation);
        var first = new DateOnly(2026,9,20);
        var result = await service.SaveWeeklyAsync(f.Event.GroupId,venue.Id,f.Owner,new(f.Event.Id,first,null,540,720,50),$"\"venue-{venue.ConcurrencyToken:N}\"","standing",default);
        Assert.True(result.IsSuccess,result.Message);
        var rule = await f.Db.EventVenueWeeklyBookings.Include(x => x.Exceptions).SingleAsync();
        var date = first.AddDays(52*7);
        var calendar = await service.CalendarAsync(f.Event.GroupId,venue.Id,f.Ordinary,date,date,default);
        var entry = Assert.Single(calendar.Value!.Entries); Assert.Null(entry.EventId); Assert.Equal("Occupied",entry.Title.En); Assert.False(entry.CanManage);
        Assert.Equal(AppResultStatus.Forbidden,(await service.ExceptionAsync(f.Event.GroupId,venue.Id,rule.Id,f.Ordinary,new(date,true,"Release"),EventVenueCalendarService.ETag(rule),"denied",default)).Status);
        var released = await service.ExceptionAsync(f.Event.GroupId,venue.Id,rule.Id,f.Owner,new(date,true,"Congregation meeting elsewhere"),EventVenueCalendarService.ETag(rule),"release",default);
        Assert.True(released.IsSuccess,released.Message);
        Assert.Empty((await service.CalendarAsync(f.Event.GroupId,venue.Id,f.Ordinary,date,date,default)).Value!.Entries);
        f.Db.EventVenueReservations.Add(new() { Id=Guid.NewGuid(),VenueId=venue.Id,EventId=f.Event.Id,StartUtc=entry.StartUtc,EndUtc=entry.EndUtc,RequiredCapacity=25,ReservedByMemberId=f.Author,Status=EventVenueReservationStatus.Confirmed }); await f.Save();
        Assert.Equal(AppResultStatus.Conflict,(await service.ExceptionAsync(f.Event.GroupId,venue.Id,rule.Id,f.Owner,new(date,false,"Return to the hall"),EventVenueCalendarService.ETag(rule),"restore",default)).Status);
        Assert.Single(await f.Db.EventVenueBookingExceptions.ToArrayAsync());
        Assert.Single(EventVenueRecurrence.Expand(rule,date.AddDays(7),date.AddDays(7)));
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task ProxyRevocation_DeniesStoredMaterialLinksAndOldApplicationWrites(bool ended)
    {
        await using var f = new Fixture(); await f.Save(); await f.Rules(2);
        var created = await f.Registration.CreateAsync(f.Event.Id,f.Ordinary,new(f.Ordinary,[new(f.Author,"Author")],ProxyAuthorityEvidence:"Author explicitly authorised me to enter the application"),"proxy-entry",default);
        Assert.True(created.IsSuccess,created.Message);
        var app = await f.Db.EventRegistrationApplications.Include(x => x.Participants).SingleAsync(); var person = app.Participants.Single();
        Assert.True(await EventRegistrationMaterialService.CanAccessAsync(f.Db,person.Id,f.Ordinary,default));
        if (ended) {
            person.SeatStatus = "expired";
            (await f.Db.EventRegistrationPolicies.SingleAsync()).Version++;
            await f.Db.SaveChangesAsync();
        }
        var tag = EventRegistrationWorkService.ApplicationETag(app);
        var result = await f.Registration.ActAsync(f.Event.Id,app.Id,f.Author,"revoke-proxy",new(ParticipantId:person.Id),tag,"withdraw-proxy",default);
        Assert.True(result.IsSuccess,result.Message);
        Assert.False(await EventRegistrationMaterialService.CanAccessAsync(f.Db,person.Id,f.Ordinary,default));
        Assert.True(await EventRegistrationMaterialService.CanAccessAsync(f.Db,person.Id,f.Author,default));
        Assert.Empty((await f.Registration.GetAsync(f.Event.Id,f.Ordinary,1,null,default)).Value!.Applications.Single().Participants);
        Assert.Equal(AppResultStatus.Forbidden,(await f.Registration.ActAsync(f.Event.Id,app.Id,f.Ordinary,"answers",new(ParticipantId:person.Id,AnswersJson:"{}"),tag,"stale-proxy",default)).Status);
    }

    private sealed class Fixture : IAsyncDisposable
    {
        public AlifeDbContext Db { get; } = new(new DbContextOptionsBuilder<AlifeDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        public Guid Owner { get; }=Guid.NewGuid(); public Guid Author { get; }=Guid.NewGuid(); public Guid Ordinary { get; }=Guid.NewGuid();
        public GroupEvent Event { get; }
        public IEventPackageInvalidationService Invalidation { get; }=Substitute.For<IEventPackageInvalidationService>();
        public IEventPackageService Approval { get; }=Substitute.For<IEventPackageService>();
        public IGroupAuthorizationService Authorization { get; }=Substitute.For<IGroupAuthorizationService>();
        public EventRegistrationWorkService Registration { get; }
        public Fixture(bool rosterEnabled = false)
        {
            var group=new Group { Id=Guid.NewGuid(),NameJson="{\"en\":\"Church\",\"zh\":\"教会\"}",IsChurch=true,CreatedUtc=DateTime.UtcNow,UpdatedUtc=DateTime.UtcNow };
            Db.Groups.Add(group);
            foreach(var id in new[]{Owner,Author,Ordinary})
            {
                Db.Members.Add(new() { Id=id,DisplayName=id==Owner?"Owner":id==Author?"Author":"Member",CreatedUtc=DateTime.UtcNow,UpdatedUtc=DateTime.UtcNow });
                Db.GroupMemberships.Add(new() { Id=Guid.NewGuid(),GroupId=group.Id,MemberId=id,Status=MembershipStatus.Approved,Role=MembershipRole.Member,CreatedUtc=DateTime.UtcNow,UpdatedUtc=DateTime.UtcNow });
            }
            Event=new() { Id=Guid.NewGuid(),GroupId=group.Id,CreatedByMemberId=Owner,AccountableOwnerMemberId=Owner,TitleEn="Event",TitleZh="活动",StartDate=DateTime.UtcNow.AddDays(30),EndDate=DateTime.UtcNow.AddDays(31),EventDataJson="{\"visibility\":\"public\"}",PublicationStatus=EventPublicationStatus.Published,RegistrationStatus=EventRegistrationStatus.Open,ActivePlanVersion=1,CollaborationVersion=1,CreatedUtc=DateTime.UtcNow,UpdatedUtc=DateTime.UtcNow };
            Db.GroupEvents.Add(Event);
            var choices = new List<ModuleSelectionInput> { new("PEOPLE.REGISTRATION",true), new("PROGRAM.PRODUCTION",true), new("MONEY.FINANCE",true), new("PLACE.RESOURCE",true) };
            if (rosterEnabled) choices.Add(new("SERVICE.ROSTER", true));
            var plan=new EventCompositionEngine().Compose(new(EventCompositionDefinitions.LegacySchemaVersion,null,new([]),choices),new EventCompositionContext("\"initial\"",HasAccountableOwner:true)).Value!;
            Db.EventPlanSnapshots.Add(new() { Id=Guid.NewGuid(),EventId=Event.Id,Version=1,SourceFactSetId=Guid.NewGuid(),SchemaVersion=plan.SchemaVersion,ProposalHash=plan.ProposalHash,ETag=EventCompositionPersistence.CreatePlanETag(1,plan.ProposalHash),SnapshotJson=EventCompositionPersistence.SerializePlan(plan,[]),IsActive=true,AcceptedByMemberId=Owner,AcceptedUtc=DateTime.UtcNow,CreatedUtc=DateTime.UtcNow });
            Role(Author,"PROGRAM.PRODUCTION:programme.lead");
            Authorization.IsApprovedMemberAsync(Arg.Any<Guid>(),Arg.Any<Guid>(),Arg.Any<CancellationToken>()).Returns(true);
            Approval.IsRegistrationApprovalCurrentAsync(Event.Id,Arg.Any<CancellationToken>()).Returns(true);
            Registration=new(Db,Invalidation,Approval);
        }
        public void Role(Guid member,string role) => Db.EventRoleAssignments.Add(new() { Id=Guid.NewGuid(),EventId=Event.Id,MemberId=member,RoleRequirementKey=role,Status=EventRoleAssignmentStatus.Accepted,AssignedByMemberId=Owner,CreatedUtc=DateTime.UtcNow,UpdatedUtc=DateTime.UtcNow });
        public Task Save()=>Db.SaveChangesAsync();
        public RegistrationRules DefaultRules(int capacity)=>new(Text,"public",null,Text,capacity,DateTime.UtcNow.AddDays(-1),Event.StartDate,true,"both",Text,Text,Text,false,[]);
        public async Task Rules(int capacity) { var result=await Registration.SaveRulesAsync(Event.Id,Owner,DefaultRules(capacity),"\"registration-new\"",default); Assert.True(result.IsSuccess,result.Message); }
        public async Task<EventRegistrationApplication> Create(int count,bool invite=false)
        {
            var result=await Registration.CreateAsync(Event.Id,Owner,new(Owner,Enumerable.Range(0,count).Select(i => new RegistrationPersonInput(null,$"Guest {Guid.NewGuid():N}")).ToArray(),IsInvitation:invite,ProxyAuthorityEvidence:"Explicit authority recorded from the guests"),Guid.NewGuid().ToString(),default);
            Assert.True(result.IsSuccess,result.Message); return await Db.EventRegistrationApplications.Include(x => x.Participants).SingleAsync(x => x.Id==result.Value);
        }
        public async Task Act(EventRegistrationApplication app,string operation,RegistrationActionRequest? request=null)
        {
            var result=await Registration.ActAsync(Event.Id,app.Id,Owner,operation,request??new(),EventRegistrationWorkService.ApplicationETag(app),Guid.NewGuid().ToString(),default); Assert.True(result.IsSuccess,result.Message);
        }
        public async Task Consent(EventRegistrationApplication app) { foreach(var p in app.Participants) await Act(app,"verify-consent",new(ParticipantId:p.Id,Evidence:"Checked written personal consent in person",OccurredUtc:DateTime.UtcNow.AddMinutes(-1))); }
        public ValueTask DisposeAsync()=>Db.DisposeAsync();
    }
}
