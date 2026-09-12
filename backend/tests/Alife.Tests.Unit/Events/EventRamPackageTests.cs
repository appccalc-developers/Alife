using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Tests.Unit.Events;
public sealed partial class EventPackageFoundationTests
{
    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task RedRamForcesEnhancedPackageWithoutCopyingPrivateDetails_AndCannotPublishWithoutApproval(bool toolEnabled)
    {
        await using var db=CreateDb();var seeded=await SeedAsync(db,false,toolEnabled?["TEAM.WORK","SAFETY.RAM"]:["TEAM.WORK"]);
        var ram=await db.EventRamAssessments.FirstOrDefaultAsync(x=>x.EventId==seeded.Event.Id);
        if(ram is null){ram=new(){EventId=seeded.Event.Id};db.EventRamAssessments.Add(ram);}
        ram.SchemaVersion=2;ram.Status=EventRamStatus.Approved;ram.Validity="Valid";ram.ResidualLevel="Red";
        ram.CurrentRevisionId=Guid.NewGuid();ram.PolicyVersionId=Guid.NewGuid();ram.AuthorMemberId=seeded.Owner;
        ram.RamDataJson="{\"privateDetails\":\"NEVER-COPY-THIS\"}";
        seeded.Event.RamAssessment=ram;seeded.Event.PublicationStatus=EventPublicationStatus.LegacyImplicit;
        await db.SaveChangesAsync();var service=new EventPackageService(db,Authorization());
        var generated=await service.GenerateAsync(seeded.Event.Id,seeded.Owner,new(EventPackageScopeType.Event,null,"1.0"),seeded.Plan.ETag,"red-ram-package",default);
        Assert.True(generated.IsSuccess,generated.Message);Assert.Equal(EventGovernanceTier.Enhanced,generated.Value!.Manifest.GovernanceTier);
        Assert.DoesNotContain("NEVER-COPY-THIS",(await db.EventPackages.SingleAsync()).ManifestJson);
        Assert.Contains(await db.EventPackageSourceReferences.ToListAsync(),s=>s.ModuleCode=="SAFETY.RAM");
        var lifecycle=await service.GetLifecycleAsync(seeded.Event.Id,seeded.Owner,default);
        var publish=await service.PublishAsync(seeded.Event.Id,seeded.Owner,new(null,null,lifecycle.Value!.ETag),"red-without-enhanced-approval",default);
        Assert.Equal(AppResultStatus.Conflict,publish.Status);Assert.Equal("event.publish.redRamRequiresEnhancedApproval",publish.Message);
    }
}
