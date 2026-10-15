-- WhatsApp bot: talk only to new contacts.
--
-- When on, the bot answers only numbers that were not in Leads yet when they
-- first messaged it. Everyone else (existing leads, old customers) is left to
-- the counsellors: their messages are still recorded in Chats and linked to
-- their lead, the bot just sends nothing. Chats the bot was already talking
-- in carry on. Decided once per chat; the bot re-reads settings every minute.

ALTER TABLE wa_bot_settings ADD COLUMN IF NOT EXISTS new_contacts_only boolean NOT NULL DEFAULT false;
