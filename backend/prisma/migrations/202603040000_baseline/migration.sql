-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."tblbranches" (
    "id" BIGSERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "branchName" VARCHAR,
    "branchAddress" TEXT,

    CONSTRAINT "tblbranches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tblbusiness_details" (
    "id" BIGSERIAL NOT NULL,
    "businessName" TEXT,
    "address" TEXT,
    "tinNumber" VARCHAR,
    "businessType" VARCHAR,
    "contactNumber" VARCHAR,
    "businessEmail" VARCHAR,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isBranch" BOOLEAN DEFAULT false,
    "status" VARCHAR,
    "statusRemarks" TEXT,

    CONSTRAINT "tblbusiness_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tblrbac" (
    "id" BIGSERIAL NOT NULL,
    "roleName" VARCHAR,
    "roleMenus" TEXT,
    "rolePermission" TEXT,
    "created_by" BIGINT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tblrbac_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tblusers" (
    "id" BIGSERIAL NOT NULL,
    "username" VARCHAR,
    "password" TEXT,
    "fullname" VARCHAR,
    "birthdate" DATE,
    "address" TEXT,
    "email" VARCHAR,
    "contact" VARCHAR,
    "status" SMALLINT,
    "is_deleted" BOOLEAN,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "created_by" BIGINT DEFAULT 1,
    "roleId" BIGINT DEFAULT 1,
    "branchId" BIGINT,

    CONSTRAINT "tblusers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tblusers_username_key" ON "public"."tblusers"("username" ASC);

-- AddForeignKey
ALTER TABLE "public"."tblusers" ADD CONSTRAINT "tblusers_branchid_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."tblbranches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tblusers" ADD CONSTRAINT "tblusers_roleid_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."tblrbac"("id") ON DELETE SET NULL ON UPDATE CASCADE;

