# ── Build stage ────────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /

# Copy project files first so NuGet restore is cached as a separate layer
COPY Alife.sln .
COPY src/Alife.Api/Alife.Api.csproj                   src/Alife.Api/
COPY src/Alife.Application/Alife.Application.csproj   src/Alife.Application/
COPY src/Alife.Domain/Alife.Domain.csproj             src/Alife.Domain/
COPY src/Alife.Infrastructure/Alife.Infrastructure.csproj src/Alife.Infrastructure/
COPY src/Alife.DbMigrator/Alife.DbMigrator.csproj     src/Alife.DbMigrator/
COPY tests/Alife.Tests.Unit/Alife.Tests.Unit.csproj   tests/Alife.Tests.Unit/

RUN dotnet restore src/Alife.Api/Alife.Api.csproj

# Copy remaining source and publish
COPY . .
RUN dotnet publish src/Alife.Api/Alife.Api.csproj \
    -c Release \
    -o /app/publish \
    --no-restore

# ── Runtime stage ───────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0-noble AS runtime
WORKDIR /app

COPY --from=build /app/publish .

# .NET non-root images listen on 8080 by default
EXPOSE 8080

ENTRYPOINT ["dotnet", "Alife.Api.dll"]

# SQL Server client requires full globalization support.
ENV DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false
