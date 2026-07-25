SELECT indexname FROM pg_indexes WHERE tablename = 'player_pass_purchases' AND indexname = 'one_pending_purchase_per_buyer';
SELECT conname FROM pg_constraint WHERE conname = 'check_slots_not_exceeded';
