using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using MediatR;

namespace Alife.Application.Events.Commands.UpdateEventFinanceSettings;

public sealed record UpdateEventFinanceOptionInput(string? Id, string NameEn, string NameZh, decimal ExtraFee);
public sealed record UpdateEventFinanceSettingsCommand(
    Guid EventId,
    Guid CurrentMemberId,
    bool Enabled,
    string Currency,
    decimal? AdultFee,
    decimal? ChildFee,
    string PaymentInstructionsEn,
    string PaymentInstructionsZh,
    string RefundPolicyEn,
    string RefundPolicyZh,
    bool PaymentEvidenceRequired,
    bool LeaderConfirmed,
    IReadOnlyList<UpdateEventFinanceOptionInput> Options)
    : IRequest<AppResult<GroupEventSummaryDto>>;
