ALTER TABLE "Client" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "Service" ADD COLUMN "workspaceId" TEXT;

DROP INDEX IF EXISTS "Client_email_key";

CREATE INDEX "Client_workspaceId_idx" ON "Client"("workspaceId");
CREATE INDEX "Client_workspaceId_email_idx" ON "Client"("workspaceId", "email");
CREATE INDEX "Service_workspaceId_idx" ON "Service"("workspaceId");

ALTER TABLE "Client" ADD CONSTRAINT "Client_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Service" ADD CONSTRAINT "Service_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
