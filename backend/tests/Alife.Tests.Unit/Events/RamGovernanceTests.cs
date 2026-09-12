using Alife.Application.Admin;
using Alife.Application.Common.Models;
using Alife.Application.Events.Commands.SaveEventRam;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using Alife.Api.Controllers;
using Alife.Application.Abstractions.Identity;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Tests.Unit.Events;

public sealed class RamGovernanceTests
{
    private static RamText Text(string value="confirmed") => new(value,value);
    private static RamPolicyData Policy() => RamPolicyDefaults.Create() with { Matrix=Enumerable.Range(1,5).SelectMany(l=>Enumerable.Range(1,5).Select(i=>new RamCell(l,i,((l+i)%3) switch{0=>"Red",1=>"Green",_=>"Yellow"}))).ToArray() };
    private static RamV2Draft Draft(RamPolicyData policy) => new()
    {
        Activities=[new(){Id="walk",Type="generic",Name=Text("Walk")}],ParticipantCount=12,AuthorAttendsAndLeads=true,
        Hazards=[new(){Id="slip",ActivityId="walk",CategoryCode="environment",Hazard=Text("Slipping"),Consequence=Text("Injury"),Likelihood=2,Impact=2,ControlMeasures=Text("Check route"),PersonResponsible="Leader",ResidualLikelihood=1,ResidualImpact=3,AdditionalAction=Text("Check again") }],
        Answers=policy.Questions.Where(q=>q.ActivityType=="generic").Select(q=>new RamAnswer("walk",RamEvaluator.QuestionKey(q),Text())).ToArray()
    };
    public static IEnumerable<object[]> Cells() => Enumerable.Range(1,5).SelectMany(l=>Enumerable.Range(1,5).Select(i=>new object[]{l,i}));
    [Theory, MemberData(nameof(Cells))]
    public void EveryCellUsesPolicyRatherThanProductThreshold(int l,int i)
    {
        var policy=Policy(); var draft=Draft(policy); draft.Hazards[0].Likelihood=l; draft.Hazards[0].Impact=i; draft.Hazards[0].ResidualLikelihood=l; draft.Hazards[0].ResidualImpact=i;
        draft.Hazards[0].RiskScore=999; draft.Hazards[0].ResidualScore=999;
        var result=RamEvaluator.Evaluate(draft,policy);
        Assert.Empty(result.Errors); Assert.Equal(l*i,draft.Hazards[0].RiskScore); Assert.Equal(l*i,draft.Hazards[0].ResidualScore);
        Assert.Equal(policy.Matrix.Single(c=>c.Likelihood==l && c.Impact==i).Level,result.ResidualLevel);
    }
    [Fact]
    public void MissingAndYellowFieldsDoNotBecomeLowRisk()
    {
        var p=Policy();var d=Draft(p);d.Hazards[0].ResidualLikelihood=null;
        Assert.Equal("Incomplete",RamEvaluator.Evaluate(d,p).ResidualLevel);
        d=Draft(p);d.Hazards[0].ResidualLikelihood=1;d.Hazards[0].ResidualImpact=1;d.Hazards[0].AdditionalAction=new();
        Assert.Contains(RamEvaluator.Evaluate(d,p).Errors,e=>e.StartsWith("ram.yellow"));
        Assert.Null(RamPolicyDefaults.Create().Matrix[0].Level);
        Assert.NotEmpty(RamEvaluator.ValidatePolicy(RamPolicyDefaults.Create(),true));
        Assert.NotEmpty(RamEvaluator.Evaluate(Draft(p),null).Errors);
    }
    [Fact]
    public void SameQuestionForTwoActivitiesRequiresTwoAnswersAndHighestResidualWins()
    {
        var p=Policy();var d=Draft(p);
        d.Activities=[..d.Activities,new(){Id="second",Type="generic",Name=Text("Other")}];
        d.Hazards=[..d.Hazards,new(){Id="two",ActivityId="second",CategoryCode="activity",Hazard=Text(),Consequence=Text(),ControlMeasures=Text(),PersonResponsible="Person",Likelihood=1,Impact=3,ResidualLikelihood=1,ResidualImpact=2}];
        Assert.Contains(RamEvaluator.Evaluate(d,p).Errors,e=>e.StartsWith("ram.answer.second"));
        d.Answers=[..d.Answers,..p.Questions.Where(q=>q.ActivityType=="generic").Select(q=>new RamAnswer("second",RamEvaluator.QuestionKey(q),new(),true,Text("Not relevant because...")))];
        Assert.Equal("Red",RamEvaluator.Evaluate(d,p).ResidualLevel);
        d.Answers=[..d.Answers.Skip(1)];Assert.Equal("Incomplete",RamEvaluator.Evaluate(d,p).ResidualLevel);
    }

    [Fact]
    public async Task PolicyIsChurchScopedDraftThenImmutableAndRestoredAsNewVersion()
    {
        using var f=await Fixture.Create();
        var unconfirmed=await f.Service.SavePolicyAsync(f.Church,f.Author,new(RamPolicyDefaults.Create(),null,"new"),default);
        Assert.True(unconfirmed.IsSuccess,unconfirmed.Message);
        var blocked=await f.Service.PublishPolicyAsync(f.Church,unconfirmed.Value!.Id!.Value,f.Author,new(unconfirmed.Value.ETag,true),default);
        Assert.Equal(AppResultStatus.ValidationError,blocked.Status);
        var draft=await f.Service.SavePolicyAsync(f.Church,f.Author,new(Policy(),unconfirmed.Value.Id,unconfirmed.Value.ETag),default);
        Assert.True(draft.IsSuccess,draft.Message);
        var published=await f.Service.PublishPolicyAsync(f.Church,draft.Value!.Id!.Value,f.Author,new(draft.Value.ETag,true),default);
        Assert.True(published.IsSuccess,published.Message);
        Assert.Equal(AppResultStatus.Conflict,(await f.Service.SavePolicyAsync(f.Church,f.Author,new(Policy(),published.Value!.Id,published.Value.ETag),default)).Status);
        var restored=await f.Service.SavePolicyAsync(f.Church,f.Author,new(published.Value.Data,null,"new"),default);
        Assert.Equal(2,restored.Value!.Version);
        Assert.Equal(AppResultStatus.Forbidden,(await f.Service.PoliciesAsync(f.OtherChurch,f.Author,default)).Status);
        Assert.Equal(AppResultStatus.Forbidden,(await f.Service.PoliciesAsync(f.Church,f.Other,default)).Status);
    }
    [Fact]
    public async Task UnpublishedPolicyAllowsDraftButPreventsConfirmationAndOldClientCannotOverwrite()
    {
        using var f=await Fixture.Create();var saved=await f.Save(null);
        Assert.True(saved.IsSuccess,saved.Message); Assert.Equal("Incomplete",saved.Value!.ResidualLevel);
        var confirm=await f.Act("request-confirmation",f.Author);
        Assert.Equal(AppResultStatus.ValidationError,confirm.Status);
        var old=new SaveEventRamCommandHandler(f.Db,f.Auth,f.Cache,new EventPackageInvalidationService(f.Db));
        Assert.Equal(AppResultStatus.Conflict,(await old.Handle(new(f.Event,f.Author,"{}"),default)).Status);
        Assert.NotEqual("{}",f.Ram.RamDataJson);
    }
    [Fact]
    public async Task PersonMustHaveAcceptedDutyAndConfirmOwnVersion_NoProxyOrSelfReview()
    {
        using var f=await Fixture.Create();await f.Publish();var d=Draft(Policy());d.AuthorAttendsAndLeads=false;d.OnsiteMemberId=f.Onsite;
        await f.Save(f.PolicyId,d);
        Assert.Equal(AppResultStatus.ValidationError,(await f.Act("request-confirmation",f.Author)).Status);
        await f.AcceptDuty();Assert.True((await f.Act("request-confirmation",f.Author)).IsSuccess);
        Assert.Equal(AppResultStatus.Forbidden,(await f.Act("confirm",f.Author)).Status);
        var workspace=await f.Service.GetAsync(f.Event,f.Onsite,default);Assert.True(workspace.IsSuccess);Assert.False(workspace.Value!.CanEdit);
        Assert.True((await f.Act("confirm",f.Onsite)).IsSuccess);
        Assert.True((await f.Act("submit",f.Author)).IsSuccess);
        Assert.Equal(AppResultStatus.Forbidden,(await f.Act("approve",f.Author)).Status);
        Assert.Equal(AppResultStatus.Forbidden,(await f.Act("approve",f.Onsite)).Status);
        Assert.True((await f.Act("approve",f.Auditor)).IsSuccess);
        Assert.Equal("Valid",f.Ram.Validity);Assert.Equal(EventPublicationStatus.Unpublished,f.Db.GroupEvents.Single().PublicationStatus);
    }
    [Fact]
    public async Task ConfirmAndAuditAreIdempotentButDifferentRequestsCannotReuseKey()
    {
        using var f=await Fixture.Create();await f.Publish();await f.Save(f.PolicyId);await f.Act("request-confirmation",f.Author);
        var request=new RamActionRequest(f.Ram.CurrentRevisionId,f.Ram.ConcurrencyToken.ToString());var key=Guid.NewGuid().ToString();
        Assert.True((await f.Service.ActAsync(f.Event,f.Author,"confirm",request,key,default)).IsSuccess);
        Assert.True((await f.Service.ActAsync(f.Event,f.Author,"confirm",request,key,default)).IsSuccess);
        Assert.Equal(1,await f.Db.EventRamActions.CountAsync(x=>x.Action=="confirm"));
        Assert.Equal(AppResultStatus.Conflict,(await f.Service.ActAsync(f.Event,f.Author,"confirm",request with{Reason="different"},key,default)).Status);
        await f.Act("submit",f.Author);
        request=new(f.Ram.CurrentRevisionId,f.Ram.ConcurrencyToken.ToString());key=Guid.NewGuid().ToString();
        Assert.True((await f.Service.ActAsync(f.Event,f.Auditor,"approve",request,key,default)).IsSuccess);
        Assert.True((await f.Service.ActAsync(f.Event,f.Auditor,"approve",request,key,default)).IsSuccess);
        Assert.Equal(1,await f.Db.EventRamActions.CountAsync(x=>x.Action=="approve"));
    }
    [Fact]
    public async Task EditsAndMaterialChangesInvalidateConfirmationButPreserveHistoryAndRejectStaleWrites()
    {
        using var f=await Fixture.Create();await f.Publish();await f.Save(f.PolicyId);await f.Act("request-confirmation",f.Author);await f.Act("confirm",f.Author);
        var revision=f.Ram.CurrentRevisionId!.Value;var etag=f.Ram.ConcurrencyToken.ToString();var draft=Draft(Policy());draft.Hazards[0].Consequence=Text("Changed");
        Assert.True((await f.Save(f.PolicyId,draft)).IsSuccess);Assert.Null(f.Ram.CurrentRevisionId);Assert.Equal("ReviewRequired",f.Ram.Validity);
        Assert.True((await f.Service.PrintAsync(f.Event,revision,f.Author,default)).IsSuccess);
        Assert.Equal(AppResultStatus.PreconditionFailed,(await f.Service.SaveAsync(f.Event,f.Author,new(RamEvaluator.Serialize(draft),f.PolicyId,etag),default)).Status);
        Assert.Equal(AppResultStatus.Forbidden,(await f.Service.PrintAsync(f.Event,revision,f.Other,default)).Status);
        await f.Act("request-confirmation",f.Author);await f.Act("confirm",f.Author);await f.Act("submit",f.Author);await f.Act("approve",f.Auditor);
        var groupEvent=f.Db.GroupEvents.Single();var invalidation=new EventPackageInvalidationService(f.Db);
        await invalidation.InvalidateForModuleChangeAsync(groupEvent,f.Author,"MOVE.STAY","travel.changed","cosmetic");Assert.Equal("Valid",f.Ram.Validity);
        await invalidation.InvalidateForModuleChangeAsync(groupEvent,f.Author,"MOVE.STAY","travel.changed","governanceCritical");await f.Db.SaveChangesAsync();
        Assert.Equal("ReviewRequired",f.Ram.Validity);Assert.Equal(EventRamStatus.Draft,f.Ram.Status);Assert.Null(f.Ram.CurrentRevisionId);Assert.Contains(f.Db.EventRamActions,a=>a.Action=="approve");
    }
    [Fact]
    public async Task RedNeedsExplicitHealthSafetySignature_ReturnAndResubmitKeepOldAudit()
    {
        using var f=await Fixture.Create();await f.Publish();var d=Draft(Policy());d.Hazards[0].ResidualLikelihood=1;d.Hazards[0].ResidualImpact=2;
        await f.Save(f.PolicyId,d);await f.Act("request-confirmation",f.Author);await f.Act("confirm",f.Author);await f.Act("submit",f.Author);
        Assert.Equal(AppResultStatus.ValidationError,(await f.Act("approve",f.Auditor)).Status);
        Assert.True((await f.Act("return",f.Auditor,"More evidence")).IsSuccess);Assert.Equal("Returned",f.Ram.Validity);
        await f.Act("request-confirmation",f.Author);await f.Act("confirm",f.Author);await f.Act("submit",f.Author);
        Assert.True((await f.Act("approve",f.Auditor,"Health and safety review completed; Enhanced approval required.",true)).IsSuccess);
        Assert.Contains(f.Db.EventRamActions,a=>a.Action=="return");Assert.Equal(2,await f.Db.EventRamRevisions.CountAsync(x=>x.SchemaVersion==2));
    }
    [Fact]
    public async Task PublishingPolicyDoesNotRevokeApprovalAndOtherChurchPolicyIsRejected()
    {
        using var f=await Fixture.Create();await f.Publish();await f.Save(f.PolicyId);await f.Act("request-confirmation",f.Author);await f.Act("confirm",f.Author);await f.Act("submit",f.Author);await f.Act("approve",f.Auditor);
        var revision=f.Ram.CurrentRevisionId;await f.Publish();Assert.Equal("Valid",f.Ram.Validity);Assert.Equal(revision,f.Ram.CurrentRevisionId);
        var wrong=new EventRamPolicyVersion{Id=Guid.NewGuid(),ChurchId=f.OtherChurch,Version=1,IsPublished=true,PolicyJson=RamEvaluator.Serialize(Policy())};f.Db.EventRamPolicyVersions.Add(wrong);await f.Db.SaveChangesAsync();
        Assert.Equal(AppResultStatus.ValidationError,(await f.Save(wrong.Id)).Status);
        Assert.True((await f.Act("request-review",f.Auditor,"Conditions changed")).IsSuccess);Assert.True(f.Ram.ReviewRequested);Assert.Equal("ReviewRequired",f.Ram.Validity);
    }
    [Fact]
    public async Task LegacyApprovalAndInitialScoresAreArchivedWithoutInventedResiduals()
    {
        using var f=await Fixture.Create();var old=new EventRamAssessment{EventId=f.Event,Status=EventRamStatus.Approved,ApprovedByMemberId=f.Auditor,ApprovedUtc=DateTime.UtcNow,RamDataJson="{\"hazards\":[{\"likelihood\":2,\"impact\":3,\"riskScore\":6}]}"};f.Db.EventRamAssessments.Add(old);f.Db.GroupEvents.Single().RamAssessment=old;await f.Db.SaveChangesAsync();
        await f.Publish();await f.Save(f.PolicyId);
        var legacy=await f.Db.EventRamRevisions.SingleAsync(x=>x.SchemaVersion==1);Assert.Equal(old.EventId,legacy.EventId);Assert.DoesNotContain("residual",legacy.RamDataJson);Assert.Contains(f.Db.EventRamActions,a=>a.Action=="legacy-approved" && a.ActorMemberId==f.Auditor);
    }

    [Fact]
    public async Task WorkspacePrintAndPolicyResponsesArePrivateNoStoreIncludingDeniedViewers()
    {
        using var f=await Fixture.Create();await f.Publish();await f.Save(f.PolicyId);await f.Act("request-confirmation",f.Author);
        var members=Substitute.For<ICurrentMemberAccessor>();members.GetCurrentMemberId().Returns(f.Author);
        var controller=new EventRamGovernanceController(f.Service,members){ControllerContext=new(){HttpContext=new DefaultHttpContext()}};
        Assert.IsType<OkObjectResult>(await controller.Get(f.Event,default));
        Assert.Equal("private, no-store",controller.Response.Headers.CacheControl.ToString());
        Assert.IsType<OkObjectResult>(await controller.Print(f.Event,f.Ram.CurrentRevisionId!.Value,default));
        members.GetCurrentMemberId().Returns(f.Other);
        Assert.IsType<ObjectResult>(await controller.Print(f.Event,f.Ram.CurrentRevisionId.Value,default));
        Assert.Equal("private, no-store",controller.Response.Headers.CacheControl.ToString());
        var admin=new AdminRamPoliciesController(f.Service,members){ControllerContext=new(){HttpContext=new DefaultHttpContext()}};
        var denied=Assert.IsType<ObjectResult>(await admin.List(f.Church,default));Assert.Equal(403,denied.StatusCode);
        Assert.Equal("private, no-store",admin.Response.Headers.CacheControl.ToString());
    }

    [Fact]
    public void NullPolicyEntriesAreValidationFailuresInsteadOfServerErrors()
    {
        var policy=Policy();policy.Matrix[0]=null!;
        Assert.Contains(RamEvaluator.ValidatePolicy(policy,true),x=>x.Contains("shape"));
        Assert.Contains(RamEvaluator.ValidatePolicy(null!,false),x=>x.Contains("shape"));
    }

    [Fact]
    public async Task WithdrawnOnsiteDutyCannotSubmitAnOtherwiseConfirmedVersion()
    {
        using var f=await Fixture.Create();await f.Publish();await f.AcceptDuty();
        var draft=Draft(Policy());draft.AuthorAttendsAndLeads=false;draft.OnsiteMemberId=f.Onsite;
        Assert.True((await f.Save(f.PolicyId,draft)).IsSuccess);
        Assert.True((await f.Act("request-confirmation",f.Author)).IsSuccess);
        Assert.True((await f.Act("confirm",f.Onsite)).IsSuccess);
        f.Db.EventRoleAssignments.Single().EndedUtc=DateTime.UtcNow;await f.Db.SaveChangesAsync();
        Assert.Equal(AppResultStatus.Conflict,(await f.Act("submit",f.Author)).Status);
    }

    private sealed class Fixture : IDisposable
    {
        public AlifeDbContext Db {get;}=new(new DbContextOptionsBuilder<AlifeDbContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        public IGroupAuthorizationService Auth {get;}=Substitute.For<IGroupAuthorizationService>();
        public IEventCacheInvalidationService Cache {get;}=Substitute.For<IEventCacheInvalidationService>();
        public EventRamGovernanceService Service => new(Db,Auth,Cache,new EventPackageInvalidationService(Db));
        public Guid Church {get;}=Guid.NewGuid(); public Guid OtherChurch {get;}=Guid.NewGuid();public Guid Group {get;}=Guid.NewGuid();public Guid Event {get;}=Guid.NewGuid();
        public Guid Author {get;}=Guid.NewGuid();public Guid Onsite {get;}=Guid.NewGuid();public Guid Auditor {get;}=Guid.NewGuid();public Guid Other {get;}=Guid.NewGuid();
        public Guid? PolicyId {get;private set;}
        public EventRamAssessment Ram => Db.EventRamAssessments.Local.Single(x=>x.EventId==Event);
        public static async Task<Fixture> Create()
        {
            var f=new Fixture();
            f.Db.Groups.AddRange(new Group{Id=f.Church,IsChurch=true},new Group{Id=f.OtherChurch,IsChurch=true},new Group{Id=f.Group,ParentGroupId=f.Church});
            var role=new PlatformRole{Id=850,Code="ram-test",NameJson="{}",PermissionsJson=AdminPermissionCatalog.WritePermissions([AdminPermissionCatalog.ManageRamPolicies,AdminPermissionCatalog.AuditEvents])};f.Db.PlatformRoles.Add(role);
            foreach(var actor in new[]{f.Author,f.Onsite,f.Auditor,f.Other})
            {
                f.Db.Members.Add(new(){Id=actor,DisplayName="Member",IsRegistered=true});
                f.Db.MemberPlatformRoles.Add(new(){Id=Guid.NewGuid(),MemberId=actor,RoleId=850});
                f.Db.GroupMemberships.Add(new(){Id=Guid.NewGuid(),GroupId=actor==f.Other?f.OtherChurch:f.Church,MemberId=actor,Status=MembershipStatus.Approved,Role=MembershipRole.Member});
            }
            f.Db.GroupEvents.Add(new(){Id=f.Event,GroupId=f.Group,CreatedByMemberId=f.Author,AccountableOwnerMemberId=f.Author,EventDataJson="{}",TitleEn="Activity",TitleZh="活动",StartDate=DateTime.UtcNow,EndDate=DateTime.UtcNow.AddHours(2)});
            f.Auth.IsLeaderOrCoLeaderAsync(f.Group,f.Author,Arg.Any<CancellationToken>()).Returns(true);
            await f.Db.SaveChangesAsync();return f;
        }
        public async Task Publish()
        {
            var save=await Service.SavePolicyAsync(Church,Author,new(Policy(),null,"new"),default);Assert.True(save.IsSuccess,save.Message);
            var publish=await Service.PublishPolicyAsync(Church,save.Value!.Id!.Value,Author,new(save.Value.ETag,true),default);Assert.True(publish.IsSuccess,publish.Message);PolicyId=publish.Value!.Id;
        }
        public Task<AppResult<EventRamAssessmentDto>> Save(Guid? policy,RamV2Draft? draft=null) => Service.SaveAsync(Event,Author,new(RamEvaluator.Serialize(draft??Draft(Policy())),policy,Db.EventRamAssessments.Local.FirstOrDefault()?.ConcurrencyToken.ToString()??"new"),default);
        public Task<AppResult<EventRamAssessmentDto>> Act(string action,Guid actor,string reason="",bool signed=false) => Service.ActAsync(Event,actor,action,new(Ram.CurrentRevisionId,Ram.ConcurrencyToken.ToString(),reason,signed),Guid.NewGuid().ToString(),default);
        public async Task AcceptDuty() { Db.EventRoleAssignments.Add(new(){Id=Guid.NewGuid(),EventId=Event,MemberId=Onsite,RoleRequirementKey="SAFETY.RAM:ram.onsite",Status=EventRoleAssignmentStatus.Accepted,AcceptedUtc=DateTime.UtcNow});await Db.SaveChangesAsync(); }
        public void Dispose()=>Db.Dispose();
    }
}
