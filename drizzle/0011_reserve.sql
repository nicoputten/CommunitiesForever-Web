-- WEB-47: WEB-40's "Maybe, first in line" (an I'm in on a full role) becomes the answer state reserve (decided with
-- Nico, 2026-10-27). Plain Maybes stay Maybe; the role per sign-up was already stored with each answer.
UPDATE `run_answers` SET `answer` = 'reserve', `waitlisted` = 0 WHERE `waitlisted` = 1 AND `answer` = 'maybe';
