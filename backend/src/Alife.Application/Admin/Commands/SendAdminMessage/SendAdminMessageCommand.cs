using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Admin.Commands.SendAdminMessage;

public sealed record SendAdminMessageCommand(
    Guid CurrentMemberId,
    string Scope,
    Guid? RecipientMemberId,
    Guid? GroupId,
    string ActionType,
    string TitleEn,
    string TitleZh,
    string BodyEn,
    string BodyZh)
    : IRequest<AppResult<AdminSendMessageResultDto>>;
