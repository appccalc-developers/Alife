# ── Build stage ────────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /app

# Copy project files first to cache NuGet restore
COPY Alife.sln .
COPY src/Alife.Api/Alife.Api.csproj                   src/Alife.Api/ [cite:2]
COPY src/Alife.Application/Alife.Application.csproj   src/Alife.Application/ [cite:2]
COPY src/Alife.Domain/Alife.Domain.csproj             src/Alife.Domain/ [cite:2]
COPY src/Alife.Infrastructure/Alife.Infrastructure.csproj src/Alife.Infrastructure/ [cite:2]
COPY src/Alife.DbMigrator/Alife.DbMigrator.csproj     src/Alife.DbMigrator/ [cite:2]
COPY tests/Alife.Tests.Unit/Alife.Tests.Unit.csproj   tests/Alife.Tests.Unit/ [cite:2]

RUN dotnet restore Alife.sln

# Copy remaining source and publish both apps
COPY . . 
RUN dotnet publish src/Alife.Api/Alife.Api.csproj -c Release -o /app/publish/api --no-restore
RUN dotnet publish src/Alife.DbMigrator/Alife.DbMigrator.csproj -c Release -o /app/publish/migrator --no-restore

# ── Runtime stage ───────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0-noble AS runtime
WORKDIR /app

# Install ICU for SQL Server globalization support
RUN apt-get update && apt-get install -y libicu-dev && rm -rf /var/lib/apt/lists/*

# Copy published outputs
COPY --from=build /app/publish/api ./api
COPY --from=build /app/publish/migrator ./migrator

# Default to the API folder
WORKDIR /app/api
EXPOSE 8080

ENTRYPOINT ["dotnet", "Alife.Api.dll"]

# Enable globalization for SQL Client [cite: 5]
ENV DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false