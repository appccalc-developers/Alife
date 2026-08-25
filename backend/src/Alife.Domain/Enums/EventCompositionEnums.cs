namespace Alife.Domain.Enums;

public enum EventPlanStatus { Draft = 0, Active = 1, Ready = 2, Completed = 3, Cancelled = 4 }
public enum EventModuleStatus { NotConfigured = 0, Configuring = 1, Ready = 2, Blocked = 3, Completed = 4 }
public enum EventReadinessStatus { Pending = 0, Satisfied = 1, Blocked = 2, Waived = 3 }
public enum EventDecisionStatus { Requested = 0, Approved = 1, Rejected = 2, Returned = 3, Cancelled = 4 }
public enum EventProgrammeItemStatus { Draft = 0, Ready = 1, Completed = 2 }
