-- Manual deployment step. Reconcile the existing denormalized counter once;
-- Home then reads it by template primary key instead of COUNT/GROUP BY.
-- No user content is deleted. Deploy counter-maintaining delete handlers with
-- this migration; ranking/duel creation already increments in its transaction.
UPDATE templates SET use_count = (
  SELECT COUNT(*) FROM rankings WHERE rankings.template_id = templates.id
);
