CREATE TABLE IF NOT EXISTS `quotes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `quote` text NOT NULL,
  `author` varchar(255) DEFAULT NULL,
  `source` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `quote_tags` (
  `quote_id` int(11) NOT NULL,
  `tag` varchar(100) NOT NULL,
  PRIMARY KEY (`quote_id`, `tag`),
  KEY `idx_quote_tags_tag` (`tag`),
  CONSTRAINT `fk_quote_tags_quote`
    FOREIGN KEY (`quote_id`) REFERENCES `quotes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO quotes(quote, author)
VALUES("Be the change you want to see in the world.", "Gandhi"), ("Master patterns in life, and  you'll never suffer is the secret","someone");

