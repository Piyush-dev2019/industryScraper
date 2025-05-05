import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigration1746437596279 implements MigrationInterface {
    name = 'InitialMigration1746437596279'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "ministry" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "url" character varying NOT NULL, CONSTRAINT "PK_9279166bcd571de7497c6c667a4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "report_ministry" ("id" SERIAL NOT NULL, "exactSourceUrl" text array, "reportId" integer NOT NULL, "ministryId" integer NOT NULL, CONSTRAINT "PK_5ce8ea103f46bbc8bec80ad0498" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."report_status_enum" AS ENUM('processed', 'idle', 'failed')`);
        await queryRunner.query(`CREATE TABLE "report" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "documentUrl" character varying NOT NULL, "blobUrl" character varying NOT NULL, "year" integer, "status" "public"."report_status_enum" NOT NULL DEFAULT 'idle', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_99e4d0bea58cba73c57f935a546" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "report_ministry" ADD CONSTRAINT "FK_a957ca2142fd8d9c53b9d3886ec" FOREIGN KEY ("reportId") REFERENCES "report"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "report_ministry" ADD CONSTRAINT "FK_488c8d2d30e3e968c8e2c5157d3" FOREIGN KEY ("ministryId") REFERENCES "ministry"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "report_ministry" DROP CONSTRAINT "FK_488c8d2d30e3e968c8e2c5157d3"`);
        await queryRunner.query(`ALTER TABLE "report_ministry" DROP CONSTRAINT "FK_a957ca2142fd8d9c53b9d3886ec"`);
        await queryRunner.query(`DROP TABLE "report"`);
        await queryRunner.query(`DROP TYPE "public"."report_status_enum"`);
        await queryRunner.query(`DROP TABLE "report_ministry"`);
        await queryRunner.query(`DROP TABLE "ministry"`);
    }

}
