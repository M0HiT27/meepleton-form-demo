-- This is an empty migration.
CREATE UNIQUE INDEX one_pending_purchase_per_buyer
  ON player_pass_purchases (email, mobile)
  WHERE status = 'PENDING';

ALTER TABLE games
  ADD CONSTRAINT check_slots_not_exceeded
  CHECK (current_booked_slots <= max_slots);