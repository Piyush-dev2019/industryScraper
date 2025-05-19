import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPrivateBodyTables1746437596280 implements MigrationInterface {
    name = 'AddPrivateBodyTables1746437596280'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create private_body table
        await queryRunner.query(`
            CREATE TABLE "private_body" (
                "id" SERIAL NOT NULL,
                "name" character varying NOT NULL,
                "url" character varying NOT NULL,
                CONSTRAINT "PK_private_body" PRIMARY KEY ("id")
            )
        `);

        // Create report_private_body table
        await queryRunner.query(`
            CREATE TABLE "report_private_body" (
                "id" SERIAL NOT NULL,
                "exactSourceUrl" text array,
                "reportId" integer NOT NULL,
                "privateBodyId" integer NOT NULL,
                CONSTRAINT "PK_report_private_body" PRIMARY KEY ("id")
            )
        `);

        // Add foreign key constraints
        await queryRunner.query(`
            ALTER TABLE "report_private_body" 
            ADD CONSTRAINT "FK_report_private_body_report" 
            FOREIGN KEY ("reportId") 
            REFERENCES "report"("id") 
            ON DELETE CASCADE 
            ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "report_private_body" 
            ADD CONSTRAINT "FK_report_private_body_private_body" 
            FOREIGN KEY ("privateBodyId") 
            REFERENCES "private_body"("id") 
            ON DELETE RESTRICT 
            ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop foreign key constraints
        await queryRunner.query(`ALTER TABLE "report_private_body" DROP CONSTRAINT "FK_report_private_body_private_body"`);
        await queryRunner.query(`ALTER TABLE "report_private_body" DROP CONSTRAINT "FK_report_private_body_report"`);

        // Drop tables
        await queryRunner.query(`DROP TABLE "report_private_body"`);
        await queryRunner.query(`DROP TABLE "private_body"`);
    }
}
