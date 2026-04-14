using Alife.Application.Common.Models;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Results;

public static class AppResultExtensions
{
    extension(ControllerBase controller)
    {
        public ActionResult ToActionResult<T>(AppResult<T> result)
        {
            return result.Status switch
            {
                AppResultStatus.Success => controller.Ok(result.Value),
                AppResultStatus.NotFound => controller.NotFound(new { message = result.Message }),
                AppResultStatus.Forbidden => controller.Forbid(),
                AppResultStatus.ValidationError => controller.BadRequest(new { message = result.Message }),
                AppResultStatus.Conflict => controller.Conflict(new { message = result.Message }),
                _ => controller.StatusCode(StatusCodes.Status500InternalServerError)
            };
        }
    }
}
