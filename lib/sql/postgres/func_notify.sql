-- Function: public.notification()

-- DROP FUNCTION public.notification();

CREATE OR REPLACE FUNCTION notification()
  RETURNS trigger AS
$BODY$
DECLARE
	head	text;
	message	text;
	msg_len	integer;
	chunk	integer;
	chunks	integer;
	ch_size	CONSTANT integer := 70;
BEGIN
  IF TG_OP = 'UPDATE' THEN
	SELECT
		TG_TABLE_NAME || '#' || NEW.id,
		json_build_object(
			'new', row_to_json(NEW),
			'old', row_to_json(OLD)
		)::text
	INTO head, message;
  END IF;

  IF TG_OP = 'INSERT' THEN
	SELECT
		TG_TABLE_NAME || '#' || NEW.id,
		json_build_object(
			'new', row_to_json(NEW)
		)::text
	INTO head, message;
  END IF;

  IF TG_OP = 'DELETE' THEN
	SELECT
		TG_TABLE_NAME || '#' || OLD.id,
		json_build_object(
			'old', row_to_json(OLD)
		)::text
	INTO head, message;
  END IF;

  SELECT char_length(message) INTO msg_len;
  SELECT (msg_len / ch_size) + 1 INTO chunks;

  FOR chunk IN 1..chunks LOOP
      PERFORM pg_notify(LOWER(TG_OP),
        head || '#' || chunk || '#' || chunks || '#' ||
        substr(message, ((chunk - 1) * ch_size) + 1, ch_size)
      );
  END LOOP;
  RETURN NULL;

END;
$BODY$
  LANGUAGE plpgsql VOLATILE
  COST 100;
ALTER FUNCTION notification()
  OWNER TO manuel;
