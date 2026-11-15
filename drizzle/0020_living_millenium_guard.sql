ALTER TABLE "api_logs" ADD COLUMN "prompt_tokens" integer;--> statement-breakpoint
ALTER TABLE "api_logs" ADD COLUMN "completion_tokens" integer;--> statement-breakpoint
ALTER TABLE "api_logs" ADD COLUMN "cached_tokens" integer;--> statement-breakpoint
ALTER TABLE "api_logs" ADD COLUMN "cost_usd" double precision;