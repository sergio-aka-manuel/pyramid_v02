DROP TABLE IF EXISTS config;

CREATE TABLE config
(
   id smallserial NOT NULL,
   type smallint NOT NULL DEFAULT 0,
   data jsonb NOT NULL DEFAULT '{}',
   created_at timestamp with time zone NOT NULL DEFAULT now(),
   lastmod_at timestamp with time zone NOT NULL DEFAULT now(),
   PRIMARY KEY (id)
)
WITH
(
    OIDS = FALSE
);

ALTER TABLE config
    OWNER TO manuel
;
