CREATE TABLE "guest_recovery_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"appointment_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "guest_recovery_challenges" ADD CONSTRAINT "guest_recovery_challenges_salon_id_salons_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_recovery_challenges" ADD CONSTRAINT "guest_recovery_challenges_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "guest_recovery_appointment_created_idx" ON "guest_recovery_challenges" USING btree ("appointment_id","created_at");--> statement-breakpoint
CREATE INDEX "guest_recovery_expiry_idx" ON "guest_recovery_challenges" USING btree ("expires_at");