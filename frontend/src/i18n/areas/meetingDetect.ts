// Область: автодетект встречи (Zoom / Google Meet / Яндекс Телемост и т.д.).
// Плашка-предложение включить запись, когда обнаружена активная аудио-сессия.
import type { Dict } from "../types";

export const en: Dict = {
  "meetingDetect.title": "Record this meeting?",
  "meetingDetect.description": "Looks like a meeting is in progress ({app}). Start recording?",
  "meetingDetect.descriptionGeneric": "Looks like a meeting is in progress. Start recording?",
  "meetingDetect.record": "Record",
  "meetingDetect.dismiss": "Not now",
};

export const ru: Dict = {
  "meetingDetect.title": "Записать встречу?",
  "meetingDetect.description": "Похоже, идёт встреча ({app}). Включить запись?",
  "meetingDetect.descriptionGeneric": "Похоже, идёт встреча. Включить запись?",
  "meetingDetect.record": "Записать",
  "meetingDetect.dismiss": "Не сейчас",
};
