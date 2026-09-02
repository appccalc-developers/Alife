using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Services;

public sealed class EventOperationsService(
    IAlifeDbContext db,
    IGroupAuthorizationService authorization,
    IEventPackageInvalidationService? packageInvalidation = null) : IEventOperationsService
{
    public async Task<AppResult<IReadOnlyList<EventOccurrenceDto>>> ListOccurrencesAsync(Guid eventId, Guid memberId, CancellationToken ct)
    {
        var groupEvent = await db.GroupEvents.AsNoTracking().FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (groupEvent is null) return AppResult<IReadOnlyList<EventOccurrenceDto>>.NotFound("Event not found.");
        if (!await authorization.IsApprovedMemberAsync(groupEvent.GroupId, memberId, ct) &&
            !await EventCompositionPersistence.CanViewEventTeamAsync(db, authorization, groupEvent, memberId, ct))
            return AppResult<IReadOnlyList<EventOccurrenceDto>>.Forbidden("Approved group membership or event-team access is required.");
        var values = await db.EventOccurrences.AsNoTracking().Where(x => x.EventId == eventId).OrderBy(x => x.StartUtc).ToListAsync(ct);
        return AppResult<IReadOnlyList<EventOccurrenceDto>>.Success(values.Select(x => new EventOccurrenceDto(
            x.Id, x.EventId, x.StartUtc, x.EndUtc, x.LocalDate, x.Status, x.IsLegacyBackfill)).ToArray());
    }

    public async Task<AppResult<EventTeamWorkspaceDto>> GetTeamAsync(Guid eventId, Guid memberId, CancellationToken ct)
    {
        var groupEvent = await db.GroupEvents.AsNoTracking().FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (groupEvent is null) return AppResult<EventTeamWorkspaceDto>.NotFound("Event not found.");
        var canManage = await CanManage(groupEvent, memberId, ct);
        var canViewTeam = canManage || await EventCompositionPersistence.CanViewEventTeamAsync(db, authorization, groupEvent, memberId, ct);
        var hasInvitation = !canViewTeam && (await db.EventTeamMembers.AsNoTracking().AnyAsync(x =>
            x.EventId == eventId && x.MemberId == memberId && x.EndedUtc == null, ct) ||
            await db.EventRoleAssignments.AsNoTracking().AnyAsync(x =>
                x.EventId == eventId && x.MemberId == memberId && x.EndedUtc == null, ct));
        if (!canViewTeam && !hasInvitation)
            return AppResult<EventTeamWorkspaceDto>.Forbidden("Accepted event-team membership or a personal invitation is required.");

        var members = await db.EventTeamMembers.AsNoTracking().Where(x => x.EventId == eventId)
            .Include(x => x.Member).OrderBy(x => x.CreatedUtc).ToListAsync(ct);
        var roles = await db.EventRoleAssignments.AsNoTracking().Where(x => x.EventId == eventId)
            .OrderBy(x => x.RoleRequirementKey).ToListAsync(ct);
        var tasks = await TaskQuery(eventId).OrderBy(x => x.DueUtc).ThenBy(x => x.CreatedUtc).ToListAsync(ct);
        IReadOnlyList<RoleRequirementDto> roleRequirements = [];
        var snapshot = await db.EventPlanSnapshots.AsNoTracking().Where(x => x.EventId == eventId && x.IsActive)
            .OrderByDescending(x => x.Version).FirstOrDefaultAsync(ct);
        if (snapshot is not null)
        {
            try { roleRequirements = EventCompositionPersistence.ToSnapshotDto(snapshot).Plan.RoleRequirements; }
            catch (System.Text.Json.JsonException) { roleRequirements = []; }
        }
        if (!canViewTeam)
        {
            members = members.Where(x => x.MemberId == memberId).ToList();
            roles = roles.Where(x => x.MemberId == memberId).ToList();
            tasks = tasks.Where(x => x.AssignedMemberId == memberId).ToList();
        }
        else if (!canManage) tasks = tasks.Where(x => !x.IsRestricted || x.AssignedMemberId == memberId).ToList();

        var blockers = BuildTeamBlockers(roles, tasks, DateTime.UtcNow);
        return AppResult<EventTeamWorkspaceDto>.Success(new(
            members.Select(x => ToTeamMemberDto(x)).ToArray(), roles.Select(EventCompositionPersistence.ToDto).ToArray(),
            tasks.Select(ToTaskDto).ToArray(), roleRequirements, blockers, canManage));
    }

    public async Task<AppResult<EventTeamMemberDto>> InviteTeamMemberAsync(Guid eventId, Guid memberId, InviteEventTeamMemberRequest request, CancellationToken ct)
    {
        var groupEvent = await db.GroupEvents.FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (groupEvent is null) return AppResult<EventTeamMemberDto>.NotFound("Event not found.");
        if (!await CanManage(groupEvent, memberId, ct)) return AppResult<EventTeamMemberDto>.Forbidden("Only event managers can invite team members.");
        if (!await authorization.IsApprovedMemberAsync(groupEvent.GroupId, request.MemberId, ct))
            return AppResult<EventTeamMemberDto>.Validation("The invitee must be an approved member of the owning group.");
        if (await db.EventTeamMembers.AnyAsync(x => x.EventId == eventId && x.MemberId == request.MemberId && x.EndedUtc == null, ct))
            return AppResult<EventTeamMemberDto>.Conflict("The member already has an active team invitation or membership.");
        var now = DateTime.UtcNow;
        var entity = new EventTeamMember { Id = Guid.NewGuid(), EventId = eventId, MemberId = request.MemberId,
            InvitedByMemberId = memberId, Status = EventTeamMemberStatus.Invited, CreatedUtc = now, UpdatedUtc = now };
        db.EventTeamMembers.Add(entity);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException) { return AppResult<EventTeamMemberDto>.Conflict("The member already has an active team invitation or membership."); }
        var name = await db.Members.AsNoTracking().Where(x => x.Id == entity.MemberId).Select(x => x.DisplayName).FirstAsync(ct);
        return AppResult<EventTeamMemberDto>.Success(ToTeamMemberDto(entity, name));
    }

    public async Task<AppResult<EventTeamMemberDto>> RespondToTeamInviteAsync(Guid eventId, Guid teamMemberId, Guid memberId, bool accept, CancellationToken ct)
    {
        var entity = await db.EventTeamMembers.Include(x => x.Member)
            .FirstOrDefaultAsync(x => x.Id == teamMemberId && x.EventId == eventId, ct);
        if (entity is null) return AppResult<EventTeamMemberDto>.NotFound("Team invitation not found.");
        if (entity.MemberId != memberId) return AppResult<EventTeamMemberDto>.Forbidden("Only the invitee can respond.");
        if (entity.Status != EventTeamMemberStatus.Invited || entity.EndedUtc.HasValue)
            return AppResult<EventTeamMemberDto>.Conflict("This team invitation is no longer pending.");
        var now = DateTime.UtcNow;
        entity.Status = accept ? EventTeamMemberStatus.Accepted : EventTeamMemberStatus.Declined;
        entity.JoinedUtc = accept ? now : null;
        entity.DeclinedUtc = accept ? null : now;
        entity.EndedUtc = accept ? null : now;
        entity.UpdatedUtc = now;
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { return AppResult<EventTeamMemberDto>.Conflict("This team invitation was already answered or changed; reload before trying again."); }
        return AppResult<EventTeamMemberDto>.Success(ToTeamMemberDto(entity));
    }

    public async Task<AppResult<EventTeamMemberDto>> EndTeamMemberAsync(Guid eventId, Guid teamMemberId, Guid memberId, CancellationToken ct)
    {
        var entity = await db.EventTeamMembers.Include(x => x.Event).Include(x => x.Member)
            .FirstOrDefaultAsync(x => x.Id == teamMemberId && x.EventId == eventId, ct);
        if (entity is null) return AppResult<EventTeamMemberDto>.NotFound("Team member not found.");
        if (!await CanManage(entity.Event, memberId, ct)) return AppResult<EventTeamMemberDto>.Forbidden("Only event managers can end team membership.");
        if (!entity.EndedUtc.HasValue)
        {
            entity.Status = EventTeamMemberStatus.Ended; entity.EndedUtc = DateTime.UtcNow; entity.UpdatedUtc = entity.EndedUtc.Value;
            try { await db.SaveChangesAsync(ct); }
            catch (DbUpdateConcurrencyException) { return AppResult<EventTeamMemberDto>.Conflict("Team membership changed while it was being ended; reload and try again."); }
        }
        return AppResult<EventTeamMemberDto>.Success(ToTeamMemberDto(entity));
    }

    public async Task<AppResult<EventTaskDto>> CreateTaskAsync(Guid eventId, Guid memberId, CreateEventTaskRequest request, CancellationToken ct)
    {
        var access = await RequireManager(eventId, memberId, ct);
        if (!access.IsSuccess) return ConvertFailure<EventTaskDto>(access);
        var validation = await ValidateTaskRequest(access.Value!, request.Title, request.AssignedMemberId, request.WorkflowStepId, ct);
        if (validation is not null) return AppResult<EventTaskDto>.Validation(validation);
        var now = DateTime.UtcNow;
        var entity = new EventTask { Id = Guid.NewGuid(), EventId = eventId, WorkflowStepId = request.WorkflowStepId,
            TitleEn = request.Title.En.Trim(), TitleZh = request.Title.Zh.Trim(), DescriptionEn = request.Description?.En.Trim() ?? "",
            DescriptionZh = request.Description?.Zh.Trim() ?? "", AssignedMemberId = request.AssignedMemberId,
            DueUtc = request.DueUtc, IsRequired = request.IsRequired, RequiresApproval = request.RequiresApproval,
            IsRestricted = request.IsRestricted, CreatedUtc = now, UpdatedUtc = now };
        db.EventTasks.Add(entity);
        if ((entity.IsRequired || entity.RequiresApproval) && packageInvalidation is not null)
            await packageInvalidation.InvalidateForModuleChangeAsync(
                access.Value!, memberId, "TEAM.WORK", "event.task.created", "operational", ct);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException) { return AppResult<EventTaskDto>.Conflict("The task could not be created because related data changed; reload and try again."); }
        return AppResult<EventTaskDto>.Success(ToTaskDto(entity));
    }

    public async Task<AppResult<EventTaskDto>> UpdateTaskAsync(Guid eventId, Guid taskId, Guid memberId, UpdateEventTaskRequest request, string? ifMatch, CancellationToken ct)
    {
        var task = await TaskQuery(eventId).FirstOrDefaultAsync(x => x.Id == taskId, ct);
        if (task is null) return AppResult<EventTaskDto>.NotFound("Task not found.");
        if (await db.EventPackageConditions.AsNoTracking().AnyAsync(x => x.ReadinessTaskId == taskId, ct))
            return AppResult<EventTaskDto>.Conflict("Package condition tasks are projections; update the authoritative Package condition instead.");
        var canManage = await CanManage(task.Event, memberId, ct);
        if (!canManage && task.AssignedMemberId != memberId) return AppResult<EventTaskDto>.Forbidden("Only event managers or the assignee can update this task.");
        if (task.IsRestricted && !canManage && task.AssignedMemberId != memberId) return AppResult<EventTaskDto>.Forbidden("This task is role-restricted.");
        if (!Matches(ifMatch, TaskETag(task))) return AppResult<EventTaskDto>.PreconditionFailed("The task changed; reload before saving.");
        if (!canManage && (request.AssignedMemberId != task.AssignedMemberId || request.IsRequired != task.IsRequired ||
            request.RequiresApproval != task.RequiresApproval || request.IsRestricted != task.IsRestricted ||
            request.Status == EventTaskStatus.Cancelled || request.DueUtc != task.DueUtc ||
            !string.Equals(request.Title.En.Trim(), task.TitleEn, StringComparison.Ordinal) ||
            !string.Equals(request.Title.Zh.Trim(), task.TitleZh, StringComparison.Ordinal) ||
            !string.Equals(request.Description?.En.Trim() ?? "", task.DescriptionEn, StringComparison.Ordinal) ||
            !string.Equals(request.Description?.Zh.Trim() ?? "", task.DescriptionZh, StringComparison.Ordinal)))
            return AppResult<EventTaskDto>.Forbidden("Assignees can update task progress only.");
        if (request.Status == EventTaskStatus.Done && task.Dependencies.Any(x => x.DependsOnEventTask.Status != EventTaskStatus.Done))
            return AppResult<EventTaskDto>.Conflict("Complete prerequisite tasks first.");
        var validation = await ValidateTaskRequest(task.Event, request.Title, request.AssignedMemberId, task.WorkflowStepId, ct);
        if (validation is not null) return AppResult<EventTaskDto>.Validation(validation);
        var changesReadiness = task.AssignedMemberId != request.AssignedMemberId || task.DueUtc != request.DueUtc ||
            task.Status != request.Status || task.IsRequired != request.IsRequired ||
            task.RequiresApproval != request.RequiresApproval || task.IsRestricted != request.IsRestricted;
        task.TitleEn = request.Title.En.Trim(); task.TitleZh = request.Title.Zh.Trim();
        task.DescriptionEn = request.Description?.En.Trim() ?? ""; task.DescriptionZh = request.Description?.Zh.Trim() ?? "";
        task.AssignedMemberId = request.AssignedMemberId; task.DueUtc = request.DueUtc; task.Status = request.Status;
        task.IsRequired = request.IsRequired; task.RequiresApproval = request.RequiresApproval; task.IsRestricted = request.IsRestricted;
        task.CompletedUtc = request.Status == EventTaskStatus.Done ? DateTime.UtcNow : null;
        task.ConcurrencyToken = Guid.NewGuid(); task.UpdatedUtc = DateTime.UtcNow;
        SyncWorkflowStep(task, memberId);
        if (changesReadiness && packageInvalidation is not null)
            await packageInvalidation.InvalidateForModuleChangeAsync(
                task.Event, memberId, "TEAM.WORK", "event.task.readinessChanged", "operational", ct);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { return AppResult<EventTaskDto>.PreconditionFailed("The task changed while saving; reload and try again."); }
        return AppResult<EventTaskDto>.Success(ToTaskDto(task));
    }

    public async Task<AppResult<EventTaskDto>> CancelTaskAsync(Guid eventId, Guid taskId, Guid memberId, string? ifMatch, CancellationToken ct)
    {
        var task = await TaskQuery(eventId).FirstOrDefaultAsync(x => x.Id == taskId, ct);
        if (task is null) return AppResult<EventTaskDto>.NotFound("Task not found.");
        if (await db.EventPackageConditions.AsNoTracking().AnyAsync(x => x.ReadinessTaskId == taskId, ct))
            return AppResult<EventTaskDto>.Conflict("Package condition tasks are projections; update the authoritative Package condition instead.");
        if (!await CanManage(task.Event, memberId, ct)) return AppResult<EventTaskDto>.Forbidden("Only event managers can cancel tasks.");
        if (!Matches(ifMatch, TaskETag(task))) return AppResult<EventTaskDto>.PreconditionFailed("The task changed; reload before cancelling.");
        task.Status = EventTaskStatus.Cancelled; task.CompletedUtc = null; task.ConcurrencyToken = Guid.NewGuid(); task.UpdatedUtc = DateTime.UtcNow;
        SyncWorkflowStep(task, memberId);
        if ((task.IsRequired || task.RequiresApproval) && packageInvalidation is not null)
            await packageInvalidation.InvalidateForModuleChangeAsync(
                task.Event, memberId, "TEAM.WORK", "event.task.cancelled", "governanceCritical", ct);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { return AppResult<EventTaskDto>.PreconditionFailed("The task changed while cancelling; reload and try again."); }
        return AppResult<EventTaskDto>.Success(ToTaskDto(task));
    }

    public async Task<AppResult<EventTaskDto>> AddTaskDependencyAsync(Guid eventId, Guid taskId, Guid memberId, AddEventTaskDependencyRequest request, CancellationToken ct)
    {
        var access = await RequireManager(eventId, memberId, ct);
        if (!access.IsSuccess) return ConvertFailure<EventTaskDto>(access);
        if (taskId == request.DependsOnEventTaskId) return AppResult<EventTaskDto>.Validation("A task cannot depend on itself.");
        var tasks = await db.EventTasks.Where(x => x.EventId == eventId).Include(x => x.Dependencies).ToListAsync(ct);
        var task = tasks.FirstOrDefault(x => x.Id == taskId);
        if (task is null || tasks.All(x => x.Id != request.DependsOnEventTaskId)) return AppResult<EventTaskDto>.NotFound("Task not found.");
        if (WouldCreateCycle(tasks, taskId, request.DependsOnEventTaskId)) return AppResult<EventTaskDto>.Conflict("The dependency would create a cycle.");
        if (task.Dependencies.Any(x => x.DependsOnEventTaskId == request.DependsOnEventTaskId)) return AppResult<EventTaskDto>.Conflict("Dependency already exists.");
        db.EventTaskDependencies.Add(new EventTaskDependency { Id = Guid.NewGuid(), EventTaskId = taskId,
            DependsOnEventTaskId = request.DependsOnEventTaskId, DependencyType = NormalizeDependency(request.DependencyType), CreatedUtc = DateTime.UtcNow });
        task.ConcurrencyToken = Guid.NewGuid(); task.UpdatedUtc = DateTime.UtcNow;
        if (packageInvalidation is not null)
            await packageInvalidation.InvalidateForModuleChangeAsync(
                access.Value!, memberId, "TEAM.WORK", "event.task.dependencyAdded", "operational", ct);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { return AppResult<EventTaskDto>.PreconditionFailed("The task changed while adding the dependency; reload and try again."); }
        catch (DbUpdateException) { return AppResult<EventTaskDto>.Conflict("The dependency already exists or related task data changed."); }
        return await ReloadTask(eventId, taskId, ct);
    }

    public async Task<AppResult<EventTaskDto>> RemoveTaskDependencyAsync(Guid eventId, Guid taskId, Guid dependencyId, Guid memberId, CancellationToken ct)
    {
        var access = await RequireManager(eventId, memberId, ct); if (!access.IsSuccess) return ConvertFailure<EventTaskDto>(access);
        var task = await TaskQuery(eventId).FirstOrDefaultAsync(x => x.Id == taskId, ct);
        if (task is null) return AppResult<EventTaskDto>.NotFound("Task not found.");
        var dependency = task.Dependencies.FirstOrDefault(x => x.Id == dependencyId);
        if (dependency is null) return AppResult<EventTaskDto>.NotFound("Task dependency not found.");
        db.EventTaskDependencies.Remove(dependency); task.ConcurrencyToken = Guid.NewGuid(); task.UpdatedUtc = DateTime.UtcNow;
        if (packageInvalidation is not null)
            await packageInvalidation.InvalidateForModuleChangeAsync(
                task.Event, memberId, "TEAM.WORK", "event.task.dependencyRemoved", "operational", ct);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { return AppResult<EventTaskDto>.PreconditionFailed("The task changed while removing the dependency; reload and try again."); }
        return await ReloadTask(eventId, taskId, ct);
    }

    public async Task<AppResult<EventTaskDto>> AddTaskBlockerAsync(Guid eventId, Guid taskId, Guid memberId, AddEventTaskBlockerRequest request, CancellationToken ct)
    {
        var task = await TaskQuery(eventId).FirstOrDefaultAsync(x => x.Id == taskId, ct);
        if (task is null) return AppResult<EventTaskDto>.NotFound("Task not found.");
        if (!await CanManage(task.Event, memberId, ct) && task.AssignedMemberId != memberId)
            return AppResult<EventTaskDto>.Forbidden("Only event managers or the assignee can block this task.");
        if (string.IsNullOrWhiteSpace(request.Reason)) return AppResult<EventTaskDto>.Validation("A blocker reason is required.");
        db.EventTaskBlockers.Add(new EventTaskBlocker { Id = Guid.NewGuid(), EventTaskId = task.Id, Reason = request.Reason.Trim(),
            CreatedByMemberId = memberId, CreatedUtc = DateTime.UtcNow });
        task.Status = EventTaskStatus.Blocked; task.ConcurrencyToken = Guid.NewGuid(); task.UpdatedUtc = DateTime.UtcNow;
        if (packageInvalidation is not null)
            await packageInvalidation.InvalidateForModuleChangeAsync(
                task.Event, memberId, "TEAM.WORK", "event.task.blocked", "governanceCritical", ct);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { return AppResult<EventTaskDto>.PreconditionFailed("The task changed while adding the blocker; reload and try again."); }
        return await ReloadTask(eventId, taskId, ct);
    }

    public async Task<AppResult<EventTaskDto>> ResolveTaskBlockerAsync(Guid eventId, Guid taskId, Guid blockerId, Guid memberId, ResolveEventTaskBlockerRequest request, CancellationToken ct)
    {
        var task = await TaskQuery(eventId).FirstOrDefaultAsync(x => x.Id == taskId, ct);
        if (task is null) return AppResult<EventTaskDto>.NotFound("Task not found.");
        if (!await CanManage(task.Event, memberId, ct) && task.AssignedMemberId != memberId)
            return AppResult<EventTaskDto>.Forbidden("Only event managers or the assignee can resolve this blocker.");
        var blocker = task.Blockers.FirstOrDefault(x => x.Id == blockerId);
        if (blocker is null) return AppResult<EventTaskDto>.NotFound("Task blocker not found.");
        if (blocker.ResolvedUtc.HasValue) return AppResult<EventTaskDto>.Conflict("The blocker is already resolved.");
        if (string.IsNullOrWhiteSpace(request.Resolution)) return AppResult<EventTaskDto>.Validation("A resolution is required.");
        blocker.Resolution = request.Resolution.Trim(); blocker.ResolvedByMemberId = memberId; blocker.ResolvedUtc = DateTime.UtcNow;
        if (task.Blockers.All(x => x.ResolvedUtc.HasValue)) task.Status = EventTaskStatus.InProgress;
        task.ConcurrencyToken = Guid.NewGuid(); task.UpdatedUtc = DateTime.UtcNow;
        if (packageInvalidation is not null)
            await packageInvalidation.InvalidateForModuleChangeAsync(
                task.Event, memberId, "TEAM.WORK", "event.task.blockerResolved", "operational", ct);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { return AppResult<EventTaskDto>.PreconditionFailed("The task changed while resolving the blocker; reload and try again."); }
        return await ReloadTask(eventId, taskId, ct);
    }

    public async Task<AppResult<EventProgrammeDto>> GetProgrammeAsync(Guid eventId, Guid occurrenceId, Guid memberId, CancellationToken ct)
    {
        var occurrence = await ProgrammeQuery(eventId, occurrenceId).FirstOrDefaultAsync(ct);
        if (occurrence is null) return AppResult<EventProgrammeDto>.NotFound("Event occurrence not found.");
        var canManage = await CanCoordinate(occurrence.Event, memberId, "programme.lead", ct);
        if (!canManage && !await EventCompositionPersistence.CanViewEventTeamAsync(db, authorization, occurrence.Event, memberId, ct))
            return AppResult<EventProgrammeDto>.Forbidden("Event-team membership is required to view the programme.");
        if (!await IsModuleEnabled(eventId, "PROGRAM.PRODUCTION", ct)) return AppResult<EventProgrammeDto>.Conflict("PROGRAM.PRODUCTION is not enabled by the accepted plan.");
        return AppResult<EventProgrammeDto>.Success(ToProgrammeDto(occurrence, canManage));
    }

    public Task<AppResult<EventProgrammeDto>> CreateSessionAsync(Guid eventId, Guid occurrenceId, Guid memberId, SaveEventSessionRequest request, string? ifMatch, CancellationToken ct)
        => MutateProgramme(eventId, occurrenceId, memberId, ifMatch, async occurrence => {
            var error = ValidateSession(request); if (error is not null) return error;
            if (request.LeadMemberId.HasValue && !await authorization.IsApprovedMemberAsync(occurrence.Event.GroupId, request.LeadMemberId.Value, ct)) return "The session lead must be an approved owning-group member.";
            db.EventSessions.Add(new EventSession { Id = Guid.NewGuid(), OccurrenceId = occurrenceId,
                TitleEn = request.Title.En.Trim(), TitleZh = request.Title.Zh.Trim(), StartUtc = request.StartUtc,
                EndUtc = request.EndUtc, PlaceJson = request.PlaceJson?.Trim() ?? "{}", LeadMemberId = request.LeadMemberId,
                Status = request.Status, CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow });
            await Task.CompletedTask; return null;
        }, ct);

    public Task<AppResult<EventProgrammeDto>> UpdateSessionAsync(Guid eventId, Guid occurrenceId, Guid sessionId, Guid memberId, SaveEventSessionRequest request, string? ifMatch, CancellationToken ct)
        => MutateProgramme(eventId, occurrenceId, memberId, ifMatch, async occurrence => {
            var entity = occurrence.Sessions.FirstOrDefault(x => x.Id == sessionId); if (entity is null) return "Session not found.";
            var error = ValidateSession(request); if (error is not null) return error;
            if (request.LeadMemberId.HasValue && !await authorization.IsApprovedMemberAsync(occurrence.Event.GroupId, request.LeadMemberId.Value, ct)) return "The session lead must be an approved owning-group member.";
            entity.TitleEn = request.Title.En.Trim(); entity.TitleZh = request.Title.Zh.Trim(); entity.StartUtc = request.StartUtc;
            entity.EndUtc = request.EndUtc; entity.PlaceJson = request.PlaceJson?.Trim() ?? "{}"; entity.LeadMemberId = request.LeadMemberId;
            entity.Status = request.Status; entity.UpdatedUtc = DateTime.UtcNow; await Task.CompletedTask; return null;
        }, ct);

    public Task<AppResult<EventProgrammeDto>> DeleteSessionAsync(Guid eventId, Guid occurrenceId, Guid sessionId, Guid memberId, string? ifMatch, CancellationToken ct)
        => MutateProgramme(eventId, occurrenceId, memberId, ifMatch, async occurrence => {
            var entity = occurrence.Sessions.FirstOrDefault(x => x.Id == sessionId); if (entity is null) return "Session not found.";
            var programmeItemIds = entity.ProgramItems.Select(x => x.Id).ToArray();
            if (entity.ServiceSlots.Count != 0 || await db.EventServiceSlots.AnyAsync(x =>
                    x.ProgramItemId.HasValue && programmeItemIds.Contains(x.ProgramItemId.Value), ct))
                return "Remove service slots linked to this session or its programme items before deleting the session.";
            db.EventProgramItems.RemoveRange(entity.ProgramItems); db.EventSessions.Remove(entity); await Task.CompletedTask; return null;
        }, ct);

    public Task<AppResult<EventProgrammeDto>> CreateProgramItemAsync(Guid eventId, Guid occurrenceId, Guid sessionId, Guid memberId, SaveEventProgramItemRequest request, string? ifMatch, CancellationToken ct)
        => MutateProgramme(eventId, occurrenceId, memberId, ifMatch, async occurrence => {
            var session = occurrence.Sessions.FirstOrDefault(x => x.Id == sessionId); if (session is null) return "Session not found.";
            var error = ValidateProgramItem(request); if (error is not null) return error;
            if (request.OwnerMemberId.HasValue && !await authorization.IsApprovedMemberAsync(occurrence.Event.GroupId, request.OwnerMemberId.Value, ct)) return "The programme item owner must be an approved owning-group member.";
            db.EventProgramItems.Add(new EventProgramItem { Id = Guid.NewGuid(), SessionId = sessionId,
                TitleEn = request.Title.En.Trim(), TitleZh = request.Title.Zh.Trim(), DescriptionEn = request.Description?.En.Trim() ?? "",
                DescriptionZh = request.Description?.Zh.Trim() ?? "", StartOffsetMinutes = request.StartOffsetMinutes,
                DurationMinutes = request.DurationMinutes, OwnerMemberId = request.OwnerMemberId,
                SortOrder = session.ProgramItems.Count == 0 ? 10 : session.ProgramItems.Max(x => x.SortOrder) + 10,
                CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow }); await Task.CompletedTask; return null;
        }, ct);

    public Task<AppResult<EventProgrammeDto>> UpdateProgramItemAsync(Guid eventId, Guid occurrenceId, Guid itemId, Guid memberId, SaveEventProgramItemRequest request, string? ifMatch, CancellationToken ct)
        => MutateProgramme(eventId, occurrenceId, memberId, ifMatch, async occurrence => {
            var item = occurrence.Sessions.SelectMany(x => x.ProgramItems).FirstOrDefault(x => x.Id == itemId); if (item is null) return "Programme item not found.";
            var error = ValidateProgramItem(request); if (error is not null) return error;
            if (request.OwnerMemberId.HasValue && !await authorization.IsApprovedMemberAsync(occurrence.Event.GroupId, request.OwnerMemberId.Value, ct)) return "The programme item owner must be an approved owning-group member.";
            item.TitleEn = request.Title.En.Trim(); item.TitleZh = request.Title.Zh.Trim(); item.DescriptionEn = request.Description?.En.Trim() ?? "";
            item.DescriptionZh = request.Description?.Zh.Trim() ?? ""; item.StartOffsetMinutes = request.StartOffsetMinutes;
            item.DurationMinutes = request.DurationMinutes; item.OwnerMemberId = request.OwnerMemberId; item.UpdatedUtc = DateTime.UtcNow;
            await Task.CompletedTask; return null;
        }, ct);

    public Task<AppResult<EventProgrammeDto>> DeleteProgramItemAsync(Guid eventId, Guid occurrenceId, Guid itemId, Guid memberId, string? ifMatch, CancellationToken ct)
        => MutateProgramme(eventId, occurrenceId, memberId, ifMatch, async occurrence => {
            var item = occurrence.Sessions.SelectMany(x => x.ProgramItems).FirstOrDefault(x => x.Id == itemId); if (item is null) return "Programme item not found.";
            if (await db.EventServiceSlots.AnyAsync(x => x.ProgramItemId == itemId, ct)) return "Remove linked service slots before deleting the programme item.";
            db.EventProgramItems.Remove(item); return null;
        }, ct);

    public Task<AppResult<EventProgrammeDto>> ReorderProgramItemsAsync(Guid eventId, Guid occurrenceId, Guid sessionId, Guid memberId, ReorderEventProgramItemsRequest request, string? ifMatch, CancellationToken ct)
        => MutateProgramme(eventId, occurrenceId, memberId, ifMatch, async occurrence => {
            var session = occurrence.Sessions.FirstOrDefault(x => x.Id == sessionId); if (session is null) return "Session not found.";
            if (request.ItemIds.Count != session.ProgramItems.Count || request.ItemIds.Distinct().Count() != request.ItemIds.Count ||
                request.ItemIds.Any(id => session.ProgramItems.All(x => x.Id != id))) return "itemIds must contain every session item exactly once.";
            for (var i = 0; i < request.ItemIds.Count; i++) session.ProgramItems.First(x => x.Id == request.ItemIds[i]).SortOrder = (i + 1) * 10;
            await Task.CompletedTask; return null;
        }, ct);

    public async Task<AppResult<EventRosterDto>> GetRosterAsync(Guid eventId, Guid occurrenceId, Guid memberId, CancellationToken ct)
    {
        var occurrence = await RosterQuery(eventId, occurrenceId).FirstOrDefaultAsync(ct);
        if (occurrence is null) return AppResult<EventRosterDto>.NotFound("Event occurrence not found.");
        var canManage = await CanCoordinate(occurrence.Event, memberId, "roster.coordinator", ct);
        var canViewTeam = await EventCompositionPersistence.CanViewEventTeamAsync(db, authorization, occurrence.Event, memberId, ct);
        var isParticipant = occurrence.ServiceSlots.SelectMany(x => x.Assignments).Any(x => x.MemberId == memberId && x.EndedUtc == null);
        if (!canManage && !canViewTeam && !isParticipant) return AppResult<EventRosterDto>.Forbidden("Roster access is limited to the event team and assigned members.");
        if (!await IsModuleEnabled(eventId, "SERVICE.ROSTER", ct)) return AppResult<EventRosterDto>.Conflict("SERVICE.ROSTER is not enabled by the accepted plan.");
        return AppResult<EventRosterDto>.Success(ToRosterDto(occurrence, memberId, canManage));
    }

    public Task<AppResult<EventRosterDto>> CreateSlotAsync(Guid eventId, Guid occurrenceId, Guid memberId, SaveEventServiceSlotRequest request, string? ifMatch, CancellationToken ct)
        => MutateRoster(eventId, occurrenceId, memberId, ifMatch, async occurrence => {
            var error = ValidateSlot(occurrence, request); if (error is not null) return error;
            db.EventServiceSlots.Add(new EventServiceSlot { Id = Guid.NewGuid(), OccurrenceId = occurrenceId,
                SessionId = request.SessionId, ProgramItemId = request.ProgramItemId, ZoneId = request.ZoneId,
                RoleCode = request.RoleCode.Trim(), StartUtc = request.StartUtc, EndUtc = request.EndUtc,
                RequiredCount = request.RequiredCount, EligibilityCode = request.EligibilityCode.Trim(),
                CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow }); await Task.CompletedTask; return null;
        }, ct);

    public Task<AppResult<EventRosterDto>> UpdateSlotAsync(Guid eventId, Guid occurrenceId, Guid slotId, Guid memberId, SaveEventServiceSlotRequest request, string? ifMatch, CancellationToken ct)
        => MutateRoster(eventId, occurrenceId, memberId, ifMatch, async occurrence => {
            var slot = occurrence.ServiceSlots.FirstOrDefault(x => x.Id == slotId); if (slot is null) return "Service slot not found.";
            var error = ValidateSlot(occurrence, request); if (error is not null) return error;
            slot.SessionId = request.SessionId; slot.ProgramItemId = request.ProgramItemId; slot.ZoneId = request.ZoneId;
            slot.RoleCode = request.RoleCode.Trim(); slot.StartUtc = request.StartUtc; slot.EndUtc = request.EndUtc;
            slot.RequiredCount = request.RequiredCount; slot.EligibilityCode = request.EligibilityCode.Trim(); slot.UpdatedUtc = DateTime.UtcNow;
            await Task.CompletedTask; return null;
        }, ct);

    public Task<AppResult<EventRosterDto>> DeleteSlotAsync(Guid eventId, Guid occurrenceId, Guid slotId, Guid memberId, string? ifMatch, CancellationToken ct)
        => MutateRoster(eventId, occurrenceId, memberId, ifMatch, async occurrence => {
            var slot = occurrence.ServiceSlots.FirstOrDefault(x => x.Id == slotId); if (slot is null) return "Service slot not found.";
            if (slot.Assignments.Any(x => x.EndedUtc == null)) return "End active roster assignments before deleting the service slot.";
            db.EventRosterAvailability.RemoveRange(slot.Availability); db.EventRosterAssignments.RemoveRange(slot.Assignments); db.EventServiceSlots.Remove(slot);
            await Task.CompletedTask; return null;
        }, ct);

    public async Task<AppResult<EventRosterDto>> SetAvailabilityAsync(Guid eventId, Guid occurrenceId, Guid slotId, Guid memberId, SetEventAvailabilityRequest request, CancellationToken ct)
    {
        var occurrence = await RosterQuery(eventId, occurrenceId).FirstOrDefaultAsync(ct);
        if (occurrence is null) return AppResult<EventRosterDto>.NotFound("Event occurrence not found.");
        var slot = occurrence.ServiceSlots.FirstOrDefault(x => x.Id == slotId);
        if (slot is null) return AppResult<EventRosterDto>.NotFound("Service slot not found.");
        if (!await authorization.IsApprovedMemberAsync(occurrence.Event.GroupId, memberId, ct)) return AppResult<EventRosterDto>.Forbidden("Approved group membership is required.");
        if (!await IsModuleEnabled(eventId, "SERVICE.ROSTER", ct)) return AppResult<EventRosterDto>.Conflict("SERVICE.ROSTER is not enabled by the accepted plan.");
        var value = slot.Availability.FirstOrDefault(x => x.MemberId == memberId);
        if (value is null) db.EventRosterAvailability.Add(new EventRosterAvailability { Id = Guid.NewGuid(), ServiceSlotId = slotId, MemberId = memberId, Status = request.Status, UpdatedUtc = DateTime.UtcNow });
        else { value.Status = request.Status; value.UpdatedUtc = DateTime.UtcNow; }
        occurrence.RosterConcurrencyToken = Guid.NewGuid(); occurrence.UpdatedUtc = DateTime.UtcNow;
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { return AppResult<EventRosterDto>.PreconditionFailed("Availability changed while saving; reload and try again."); }
        catch (DbUpdateException) { return AppResult<EventRosterDto>.Conflict("Availability was updated by another request; reload and try again."); }
        return AppResult<EventRosterDto>.Success(ToRosterDto(occurrence, memberId, await CanCoordinate(occurrence.Event, memberId, "roster.coordinator", ct)));
    }

    public Task<AppResult<EventRosterDto>> AssignRosterMemberAsync(Guid eventId, Guid occurrenceId, Guid slotId, Guid memberId, AssignEventRosterMemberRequest request, string? ifMatch, CancellationToken ct)
        => MutateRoster(eventId, occurrenceId, memberId, ifMatch, async occurrence => {
            var slot = occurrence.ServiceSlots.FirstOrDefault(x => x.Id == slotId); if (slot is null) return "Service slot not found.";
            if (!await authorization.IsApprovedMemberAsync(occurrence.Event.GroupId, request.MemberId, ct)) return "The assignee must be an approved member of the owning group.";
            if (!await IsEligibleForSlot(occurrence.Event, slot, request.MemberId, ct)) return "The member does not satisfy this slot's eligibility rule.";
            var availability = slot.Availability.FirstOrDefault(x => x.MemberId == request.MemberId)?.Status ?? EventAvailabilityStatus.Unknown;
            if (availability == EventAvailabilityStatus.Unavailable) return "The member marked this slot unavailable.";
            if (slot.Assignments.Any(x => x.MemberId == request.MemberId && x.EndedUtc == null)) return "The member already has an active assignment for this slot.";
            if (request.ReplacesAssignmentId.HasValue) {
                var replaced = slot.Assignments.FirstOrDefault(x => x.Id == request.ReplacesAssignmentId && x.EndedUtc == null);
                if (replaced is null) return "The replaced assignment is not active.";
                replaced.Status = EventRosterAssignmentStatus.Ended; replaced.EndedUtc = DateTime.UtcNow; replaced.UpdatedUtc = DateTime.UtcNow;
            }
            db.EventRosterAssignments.Add(new EventRosterAssignment { Id = Guid.NewGuid(), ServiceSlotId = slot.Id, MemberId = request.MemberId,
                AssignedByMemberId = memberId, Status = EventRosterAssignmentStatus.Invited, ReplacesAssignmentId = request.ReplacesAssignmentId,
                CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow }); return null;
        }, ct);

    public async Task<AppResult<EventRosterDto>> RespondToRosterAssignmentAsync(Guid eventId, Guid occurrenceId, Guid assignmentId, Guid memberId, bool confirm, CancellationToken ct)
    {
        var occurrence = await RosterQuery(eventId, occurrenceId).FirstOrDefaultAsync(ct);
        if (occurrence is null) return AppResult<EventRosterDto>.NotFound("Event occurrence not found.");
        var assignment = occurrence.ServiceSlots.SelectMany(x => x.Assignments).FirstOrDefault(x => x.Id == assignmentId);
        if (assignment is null) return AppResult<EventRosterDto>.NotFound("Roster assignment not found.");
        if (assignment.MemberId != memberId) return AppResult<EventRosterDto>.Forbidden("Only the assignee can respond.");
        if (assignment.Status != EventRosterAssignmentStatus.Invited || assignment.EndedUtc.HasValue) return AppResult<EventRosterDto>.Conflict("This assignment is no longer pending.");
        assignment.Status = confirm ? EventRosterAssignmentStatus.Confirmed : EventRosterAssignmentStatus.Declined;
        assignment.ConfirmedUtc = confirm ? DateTime.UtcNow : null; assignment.DeclinedUtc = confirm ? null : DateTime.UtcNow;
        assignment.EndedUtc = confirm ? null : assignment.DeclinedUtc; assignment.UpdatedUtc = DateTime.UtcNow;
        occurrence.RosterConcurrencyToken = Guid.NewGuid(); occurrence.UpdatedUtc = DateTime.UtcNow;
        if (packageInvalidation is not null)
            await packageInvalidation.InvalidateForModuleChangeAsync(
                occurrence.Event, memberId, "SERVICE.ROSTER", "event.roster.assignmentResponded", "operational", ct);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { return AppResult<EventRosterDto>.PreconditionFailed("This assignment was already answered or changed; reload before trying again."); }
        return AppResult<EventRosterDto>.Success(ToRosterDto(occurrence, memberId, false));
    }

    private async Task<AppResult<GroupEvent>> RequireManager(Guid eventId, Guid memberId, CancellationToken ct)
    {
        var entity = await db.GroupEvents.FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (entity is null) return AppResult<GroupEvent>.NotFound("Event not found.");
        return await CanManage(entity, memberId, ct) ? AppResult<GroupEvent>.Success(entity) : AppResult<GroupEvent>.Forbidden("Only event managers can perform this action.");
    }

    private Task<bool> CanManage(GroupEvent groupEvent, Guid memberId, CancellationToken ct)
        => EventCompositionPersistence.CanManageEventAsync(db, authorization, groupEvent, memberId, ct);

    private async Task<bool> CanCoordinate(GroupEvent groupEvent, Guid memberId, string roleCode, CancellationToken ct)
        => await CanManage(groupEvent, memberId, ct) || await db.EventRoleAssignments.AsNoTracking().AnyAsync(x =>
            x.EventId == groupEvent.Id && x.MemberId == memberId && x.Status == EventRoleAssignmentStatus.Accepted &&
            x.EndedUtc == null && x.RoleRequirementKey.EndsWith($":{roleCode}"), ct);

    private async Task<bool> IsEligibleForSlot(GroupEvent groupEvent, EventServiceSlot slot, Guid memberId, CancellationToken ct)
    {
        if (slot.EligibilityCode == "approvedGroupMember") return true;
        if (slot.EligibilityCode == "acceptedEventTeamMember")
            return groupEvent.AccountableOwnerMemberId == memberId || await db.EventTeamMembers.AsNoTracking().AnyAsync(x =>
                x.EventId == groupEvent.Id && x.MemberId == memberId && x.Status == EventTeamMemberStatus.Accepted && x.EndedUtc == null, ct);
        const string prefix = "acceptedRole:";
        if (slot.EligibilityCode.StartsWith(prefix, StringComparison.Ordinal))
        {
            var role = slot.EligibilityCode[prefix.Length..];
            return role.Length is > 0 and <= 120 && await db.EventRoleAssignments.AsNoTracking().AnyAsync(x =>
                x.EventId == groupEvent.Id && x.MemberId == memberId && x.Status == EventRoleAssignmentStatus.Accepted &&
                x.EndedUtc == null && x.RoleRequirementKey.EndsWith($":{role}"), ct);
        }
        return false;
    }

    private async Task<bool> IsModuleEnabled(Guid eventId, string moduleCode, CancellationToken ct)
    {
        var snapshot = await db.EventPlanSnapshots.AsNoTracking().Where(x => x.EventId == eventId && x.IsActive)
            .OrderByDescending(x => x.Version).FirstOrDefaultAsync(ct);
        if (snapshot is null) return false;
        try { return EventCompositionPersistence.ToSnapshotDto(snapshot).Plan.ModuleDecisions.Any(x => x.ModuleCode == moduleCode &&
            x.Status is EventModuleDecisionStatus.Required or EventModuleDecisionStatus.Selected); }
        catch (System.Text.Json.JsonException) { return false; }
    }

    private IQueryable<EventTask> TaskQuery(Guid eventId) => db.EventTasks.Where(x => x.EventId == eventId)
        .Include(x => x.Event).Include(x => x.WorkflowStep).Include(x => x.Dependencies).ThenInclude(x => x.DependsOnEventTask)
        .Include(x => x.Blockers);

    private async Task<string?> ValidateTaskRequest(GroupEvent groupEvent, LocalizedTextDto title, Guid? assignedMemberId, Guid? workflowStepId, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(title.En) || string.IsNullOrWhiteSpace(title.Zh)) return "Bilingual task titles are required.";
        if (assignedMemberId.HasValue && assignedMemberId != groupEvent.AccountableOwnerMemberId &&
            !await db.EventTeamMembers.AsNoTracking().AnyAsync(x => x.EventId == groupEvent.Id && x.MemberId == assignedMemberId && x.Status == EventTeamMemberStatus.Accepted && x.EndedUtc == null, ct) &&
            !await db.EventRoleAssignments.AsNoTracking().AnyAsync(x => x.EventId == groupEvent.Id && x.MemberId == assignedMemberId && x.Status == EventRoleAssignmentStatus.Accepted && x.EndedUtc == null, ct))
            return "The assignee must be the accountable owner or an accepted event-team member.";
        if (workflowStepId.HasValue && !await db.EventWorkflowSteps.AsNoTracking().AnyAsync(x => x.Id == workflowStepId && x.WorkflowRun.EventId == groupEvent.Id, ct))
            return "The workflow step does not belong to this event.";
        return null;
    }

    private async Task<AppResult<EventTaskDto>> ReloadTask(Guid eventId, Guid taskId, CancellationToken ct)
    {
        var entity = await TaskQuery(eventId).FirstAsync(x => x.Id == taskId, ct);
        return AppResult<EventTaskDto>.Success(ToTaskDto(entity));
    }

    private IQueryable<EventOccurrence> ProgrammeQuery(Guid eventId, Guid occurrenceId) => db.EventOccurrences
        .Where(x => x.Id == occurrenceId && x.EventId == eventId).Include(x => x.Event)
        .Include(x => x.Sessions).ThenInclude(x => x.ProgramItems).Include(x => x.Sessions).ThenInclude(x => x.ServiceSlots);

    private async Task<AppResult<EventProgrammeDto>> MutateProgramme(Guid eventId, Guid occurrenceId, Guid memberId, string? ifMatch,
        Func<EventOccurrence, Task<string?>> mutation, CancellationToken ct)
    {
        var occurrence = await ProgrammeQuery(eventId, occurrenceId).FirstOrDefaultAsync(ct);
        if (occurrence is null) return AppResult<EventProgrammeDto>.NotFound("Event occurrence not found.");
        if (!await IsModuleEnabled(eventId, "PROGRAM.PRODUCTION", ct)) return AppResult<EventProgrammeDto>.Conflict("PROGRAM.PRODUCTION is not enabled by the accepted plan.");
        if (!await CanCoordinate(occurrence.Event, memberId, "programme.lead", ct)) return AppResult<EventProgrammeDto>.Forbidden("Programme lead access is required.");
        if (!Matches(ifMatch, ProgrammeETag(occurrence))) return AppResult<EventProgrammeDto>.PreconditionFailed("The programme changed; reload before saving.");
        var error = await mutation(occurrence); if (error is not null) return AppResult<EventProgrammeDto>.Validation(error);
        occurrence.ProgrammeConcurrencyToken = Guid.NewGuid(); occurrence.UpdatedUtc = DateTime.UtcNow;
        if (packageInvalidation is not null)
            await packageInvalidation.InvalidateForModuleChangeAsync(
                occurrence.Event, memberId, "PROGRAM.PRODUCTION", "event.programme.changed", "operational", ct);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException exception) { return AppResult<EventProgrammeDto>.PreconditionFailed($"The programme changed while saving ({exception.Entries.FirstOrDefault()?.Metadata.ClrType.Name ?? "unknown"})."); }
        catch (DbUpdateException) { return AppResult<EventProgrammeDto>.Conflict("The programme could not be saved because related data changed; reload and try again."); }
        var refreshed = await ProgrammeQuery(eventId, occurrenceId).AsNoTracking().FirstAsync(ct);
        return AppResult<EventProgrammeDto>.Success(ToProgrammeDto(refreshed, true));
    }

    private IQueryable<EventOccurrence> RosterQuery(Guid eventId, Guid occurrenceId) => db.EventOccurrences
        .Where(x => x.Id == occurrenceId && x.EventId == eventId).Include(x => x.Event)
        .Include(x => x.Sessions).ThenInclude(x => x.ProgramItems).Include(x => x.Zones)
        .Include(x => x.ServiceSlots).ThenInclude(x => x.Assignments).Include(x => x.ServiceSlots).ThenInclude(x => x.Availability);

    private async Task<AppResult<EventRosterDto>> MutateRoster(Guid eventId, Guid occurrenceId, Guid memberId, string? ifMatch,
        Func<EventOccurrence, Task<string?>> mutation, CancellationToken ct)
    {
        var occurrence = await RosterQuery(eventId, occurrenceId).FirstOrDefaultAsync(ct);
        if (occurrence is null) return AppResult<EventRosterDto>.NotFound("Event occurrence not found.");
        if (!await IsModuleEnabled(eventId, "SERVICE.ROSTER", ct)) return AppResult<EventRosterDto>.Conflict("SERVICE.ROSTER is not enabled by the accepted plan.");
        if (!await CanCoordinate(occurrence.Event, memberId, "roster.coordinator", ct)) return AppResult<EventRosterDto>.Forbidden("Roster coordinator access is required.");
        if (!Matches(ifMatch, RosterETag(occurrence))) return AppResult<EventRosterDto>.PreconditionFailed("The roster changed; reload before saving.");
        var error = await mutation(occurrence); if (error is not null) return AppResult<EventRosterDto>.Validation(error);
        occurrence.RosterConcurrencyToken = Guid.NewGuid(); occurrence.UpdatedUtc = DateTime.UtcNow;
        if (packageInvalidation is not null)
            await packageInvalidation.InvalidateForModuleChangeAsync(
                occurrence.Event, memberId, "SERVICE.ROSTER", "event.roster.changed", "operational", ct);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException exception) { return AppResult<EventRosterDto>.PreconditionFailed($"The roster changed while saving ({exception.Entries.FirstOrDefault()?.Metadata.ClrType.Name ?? "unknown"})."); }
        catch (DbUpdateException) { return AppResult<EventRosterDto>.Conflict("The roster could not be saved because related data changed; reload and try again."); }
        var refreshed = await RosterQuery(eventId, occurrenceId).AsNoTracking().FirstAsync(ct);
        return AppResult<EventRosterDto>.Success(ToRosterDto(refreshed, memberId, true));
    }

    private static EventTeamMemberDto ToTeamMemberDto(EventTeamMember x, string? displayName = null) => new(x.Id, x.EventId, x.MemberId,
        displayName ?? x.Member?.DisplayName ?? "", x.Status, x.JoinedUtc, x.DeclinedUtc, x.EndedUtc);
    private static EventTaskDto ToTaskDto(EventTask x) => new(x.Id, x.EventId, x.WorkflowStepId, new(x.TitleEn, x.TitleZh),
        new(x.DescriptionEn, x.DescriptionZh), x.AssignedMemberId, x.Status, x.IsRequired, x.RequiresApproval, x.IsRestricted,
        x.DueUtc, x.CompletedUtc, TaskETag(x), x.Dependencies.Select(d => new EventTaskDependencyDto(d.Id, d.DependsOnEventTaskId, d.DependencyType)).ToArray(),
        x.Blockers.Select(b => new EventTaskBlockerDto(b.Id, b.Reason, b.CreatedByMemberId, b.CreatedUtc, b.ResolvedByMemberId, b.Resolution, b.ResolvedUtc)).ToArray());
    private static EventProgrammeDto ToProgrammeDto(EventOccurrence x, bool canManage) => new(x.EventId, x.Id, ProgrammeETag(x),
        x.Sessions.OrderBy(s => s.StartUtc).Select(s => new EventSessionDto(s.Id, s.OccurrenceId, new(s.TitleEn, s.TitleZh), s.StartUtc, s.EndUtc,
            s.PlaceJson, s.LeadMemberId, s.Status, s.ProgramItems.OrderBy(i => i.SortOrder).Select(i => new EventProgramItemDto(i.Id, i.SessionId,
                new(i.TitleEn, i.TitleZh), new(i.DescriptionEn, i.DescriptionZh), i.SortOrder, i.StartOffsetMinutes, i.DurationMinutes, i.OwnerMemberId)).ToArray())).ToArray(), canManage);
    private static EventRosterDto ToRosterDto(EventOccurrence x, Guid memberId, bool canManage)
    {
        var slots = x.ServiceSlots.OrderBy(s => s.StartUtc).ThenBy(s => s.RoleCode).Select(s => new EventServiceSlotDto(s.Id, s.OccurrenceId,
            s.SessionId, s.ProgramItemId, s.ZoneId, s.RoleCode, s.StartUtc, s.EndUtc, s.RequiredCount, s.EligibilityCode,
            s.Assignments.Count(a => a.Status == EventRosterAssignmentStatus.Confirmed && a.EndedUtc == null),
            s.Assignments.Where(a => canManage || a.MemberId == memberId).Select(a => new EventRosterAssignmentDto(a.Id, a.ServiceSlotId,
                a.MemberId, a.Status, a.ReplacesAssignmentId, a.ConfirmedUtc, a.DeclinedUtc, a.EndedUtc)).ToArray(),
            s.Availability.FirstOrDefault(a => a.MemberId == memberId)?.Status,
            EventCompositionDefinitions.ServiceSlotLabel(s.RoleCode))).ToArray();
        var blockers = slots.Where(s => s.ConfirmedCount < s.RequiredCount).Select(s => new LocalizedTextDto(
            $"{s.RoleCode}: {s.ConfirmedCount}/{s.RequiredCount} confirmed; {s.RequiredCount - s.ConfirmedCount} missing.",
            $"{s.RoleCode}：已確認 {s.ConfirmedCount}/{s.RequiredCount}，尚缺 {s.RequiredCount - s.ConfirmedCount} 人。")).ToArray();
        return new(x.EventId, x.Id, RosterETag(x), slots, blockers, canManage);
    }

    private static IReadOnlyList<LocalizedTextDto> BuildTeamBlockers(IEnumerable<EventRoleAssignment> roles, IEnumerable<EventTask> tasks, DateTime now)
    {
        var blockers = new List<LocalizedTextDto>();
        foreach (var role in roles.Where(x => x.EndedUtc == null && x.Status != EventRoleAssignmentStatus.Accepted))
            blockers.Add(new($"Required role {role.RoleRequirementKey} is {role.Status}.", $"必要角色 {role.RoleRequirementKey} 狀態為 {role.Status}。"));
        foreach (var task in tasks.Where(x => x.IsRequired && (x.Status == EventTaskStatus.Blocked || (x.DueUtc < now && x.Status != EventTaskStatus.Done))))
            blockers.Add(new($"Required task {task.TitleEn} is blocked or overdue.", $"必要任務「{task.TitleZh}」受阻或已逾期。"));
        foreach (var task in tasks.Where(x => x.IsRequired && x.RequiresApproval && x.Status != EventTaskStatus.Done))
            blockers.Add(new($"Approval task {task.TitleEn} is incomplete.", $"批准任務「{task.TitleZh}」尚未完成。"));
        return blockers;
    }

    private static bool WouldCreateCycle(IEnumerable<EventTask> tasks, Guid taskId, Guid prerequisiteId)
    {
        var edges = tasks.ToDictionary(x => x.Id, x => x.Dependencies.Select(d => d.DependsOnEventTaskId).ToArray());
        var pending = new Stack<Guid>(); pending.Push(prerequisiteId); var seen = new HashSet<Guid>();
        while (pending.Count > 0) { var current = pending.Pop(); if (current == taskId) return true;
            if (seen.Add(current) && edges.TryGetValue(current, out var next)) foreach (var id in next) pending.Push(id); }
        return false;
    }
    private static string NormalizeDependency(string value) => value.Trim() is "finishToStart" or "blocks" ? value.Trim() : "finishToStart";
    private static string? ValidateSession(SaveEventSessionRequest x) => string.IsNullOrWhiteSpace(x.Title.En) || string.IsNullOrWhiteSpace(x.Title.Zh)
        ? "Bilingual session titles are required." : x.EndUtc <= x.StartUtc ? "Session end must be after its start." : null;
    private static string? ValidateProgramItem(SaveEventProgramItemRequest x) => string.IsNullOrWhiteSpace(x.Title.En) || string.IsNullOrWhiteSpace(x.Title.Zh)
        ? "Bilingual programme item titles are required." : x.StartOffsetMinutes < 0 || x.DurationMinutes <= 0 ? "Programme item timing is invalid." : null;
    private static string? ValidateSlot(EventOccurrence occurrence, SaveEventServiceSlotRequest x)
    {
        if (string.IsNullOrWhiteSpace(x.RoleCode) || string.IsNullOrWhiteSpace(x.EligibilityCode)) return "roleCode and eligibilityCode are required.";
        if (x.RequiredCount <= 0 || x.EndUtc <= x.StartUtc) return "Service-slot time and requiredCount are invalid.";
        if (x.SessionId.HasValue && occurrence.Sessions.All(s => s.Id != x.SessionId)) return "The session does not belong to this occurrence.";
        if (x.ProgramItemId.HasValue && occurrence.Sessions.SelectMany(s => s.ProgramItems).All(i => i.Id != x.ProgramItemId)) return "The programme item does not belong to this occurrence.";
        if (x.ZoneId.HasValue && occurrence.Zones.All(z => z.Id != x.ZoneId)) return "The zone does not belong to this occurrence.";
        if (x.ProgramItemId.HasValue && x.SessionId.HasValue && occurrence.Sessions
            .Where(s => s.Id == x.SessionId).SelectMany(s => s.ProgramItems).All(i => i.Id != x.ProgramItemId))
            return "The programme item does not belong to the selected session.";
        if (x.EligibilityCode != "approvedGroupMember" && x.EligibilityCode != "acceptedEventTeamMember" &&
            !x.EligibilityCode.StartsWith("acceptedRole:", StringComparison.Ordinal)) return "Unknown eligibilityCode.";
        return null;
    }
    private static void SyncWorkflowStep(EventTask task, Guid actorId)
    {
        if (task.WorkflowStep is null) return;
        task.WorkflowStep.Status = task.Status switch { EventTaskStatus.Todo => EventWorkflowStepStatus.NotStarted,
            EventTaskStatus.InProgress or EventTaskStatus.Blocked => EventWorkflowStepStatus.InProgress,
            EventTaskStatus.Done => EventWorkflowStepStatus.Completed, EventTaskStatus.Cancelled => EventWorkflowStepStatus.Skipped, _ => task.WorkflowStep.Status };
        task.WorkflowStep.AssignedMemberId = task.AssignedMemberId; task.WorkflowStep.DueUtc = task.DueUtc;
        task.WorkflowStep.CompletedByMemberId = task.Status == EventTaskStatus.Done ? actorId : null;
        task.WorkflowStep.CompletedUtc = task.CompletedUtc; task.WorkflowStep.UpdatedUtc = DateTime.UtcNow;
    }
    private static string TaskETag(EventTask x) => $"\"task-{x.ConcurrencyToken:N}\"";
    private static string ProgrammeETag(EventOccurrence x) => $"\"programme-{x.ProgrammeConcurrencyToken:N}\"";
    private static string RosterETag(EventOccurrence x) => $"\"roster-{x.RosterConcurrencyToken:N}\"";
    private static bool Matches(string? actual, string expected) => !string.IsNullOrWhiteSpace(actual) && string.Equals(actual.Trim(), expected, StringComparison.Ordinal);
    private static AppResult<T> ConvertFailure<T>(AppResult<GroupEvent> source) => source.Status switch {
        AppResultStatus.NotFound => AppResult<T>.NotFound(source.Message!), AppResultStatus.Forbidden => AppResult<T>.Forbidden(source.Message!),
        AppResultStatus.Conflict => AppResult<T>.Conflict(source.Message!), AppResultStatus.PreconditionFailed => AppResult<T>.PreconditionFailed(source.Message!),
        _ => AppResult<T>.Validation(source.Message ?? "Request failed.") };
}
