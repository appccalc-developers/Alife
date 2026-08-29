namespace Alife.Domain.Entities;

public sealed class MemberPasskeyCredential
{
    public Guid Id { get; set; }
    public Guid MemberId { get; set; }
    public byte[] CredentialId { get; set; } = [];
    public byte[] PublicKey { get; set; } = [];
    public byte[] UserHandle { get; set; } = [];
    public uint SignatureCounter { get; set; }
    public string? TransportsJson { get; set; }
    public bool IsBackupEligible { get; set; }
    public bool IsBackedUp { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public DateTime CreatedUtc { get; set; }
    public DateTime? LastUsedUtc { get; set; }
    public DateTime? RevokedUtc { get; set; }

    public Member Member { get; set; } = null!;
}
