namespace Alife.Domain.Entities;

public class BibleReadingProgress
{
    public Guid MemberId { get; set; }
    public string Book { get; set; } = string.Empty;
    public int Chapter { get; set; }
    public string Language { get; set; } = "zh";
    public string? ZhVersion { get; set; }
    public string? EnVersion { get; set; }
    public DateTime UpdatedUtc { get; set; }

    public Member Member { get; set; } = null!;
}
