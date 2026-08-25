using Alife.Domain.Entities;
using Alife.Domain.Enums;

namespace Alife.Application.Events.Services;

public static class EventPreparationPlanSync
{
    public const string ModuleKey = "tasks";

    public static void Apply(
        EventPlan plan,
        IEnumerable<EventPreparationTask> tasks,
        DateTime eventStartUtc,
        Guid actorMemberId,
        DateTime now)
    {
        var taskList = tasks.ToArray();
        var required = taskList.Any(x => x.IsRequired && x.Status != EventPreparationTaskStatus.Cancelled);
        var module = plan.Modules.FirstOrDefault(x => x.ModuleKey == ModuleKey);
        if (module is null)
        {
            module = new EventModuleInstance
            {
                Id = Guid.NewGuid(), EventPlanId = plan.Id, ModuleKey = ModuleKey, ModuleVersion = 1,
                AddedByMemberId = actorMemberId, CreatedUtc = now, ConfigurationJson = "{}"
            };
            plan.Modules.Add(module);
        }
        module.IsRequired = required;
        module.Status = EventPreparationTaskPolicy.ModuleStatus(taskList, eventStartUtc, now);
        module.UpdatedUtc = now;

        var gate = plan.ReadinessGates.FirstOrDefault(x => x.GateKey == "tasks.completed");
        if (gate is null)
        {
            gate = new EventReadinessGate
            {
                Id = Guid.NewGuid(), EventPlanId = plan.Id, ModuleInstanceId = module.Id,
                GateKey = "tasks.completed", NameEn = "Required preparation tasks completed", NameZh = "必要筹备任务已完成",
                ExplanationJson = "{}", ModuleInstance = module
            };
            plan.ReadinessGates.Add(gate);
        }
        gate.IsRequired = required;
        gate.Status = module.Status switch
        {
            EventModuleStatus.Ready or EventModuleStatus.Completed => EventReadinessStatus.Satisfied,
            EventModuleStatus.Blocked => EventReadinessStatus.Blocked,
            _ => EventReadinessStatus.Pending
        };
        gate.UpdatedUtc = now;
    }
}
