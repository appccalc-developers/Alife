namespace Alife.Application.Events.Services;

internal static class EventDutyAccess
{
    public static Guid OwnerId(Alife.Domain.Entities.GroupEvent e)
        => e.AccountableOwnerMemberId == Guid.Empty ? e.CreatedByMemberId : e.AccountableOwnerMemberId;
    public static bool IsTaskParticipant(bool approvedGroupMember, bool owner, bool acceptedTeam, bool acceptedRole)
        => approvedGroupMember && (owner || acceptedTeam || acceptedRole);

    public static bool IsRosterEligible(string code, bool approvedGroupMember, bool participant, IEnumerable<string> acceptedRoles)
    {
        if (!approvedGroupMember) return false;
        if (code == "approvedGroupMember") return true;
        if (code == "acceptedEventTeamMember") return participant;
        const string prefix = "acceptedRole:";
        if (!code.StartsWith(prefix, StringComparison.Ordinal)) return false;
        var role = code[prefix.Length..];
        return role.Length is > 0 and <= 120 && acceptedRoles.Any(key => key.EndsWith($":{role}", StringComparison.Ordinal));
    }

    public static bool IsRamAuthorRole(string key) => key == "ram.author" || key.EndsWith(":ram.author", StringComparison.Ordinal);
    public static bool IsIndependentRamReviewer(Guid actor, Guid author, Guid? onsite, Guid? submitter)
        => actor != author && actor != onsite && actor != submitter;
}
