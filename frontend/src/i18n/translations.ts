// Реестр словарей локализации. Каждая область живёт в отдельном файле
// (src/i18n/areas/*.ts) и редактируется независимо — это позволяет работать
// над разными областями параллельно без конфликтов. Здесь они сливаются в
// один плоский словарь на язык. Ключи неймспейснуты по областям
// (recording.*, sidebar.* и т.д.), поэтому коллизий при слиянии нет.
import type { Lang, Dict } from "./types";
import * as common from "./areas/common";
import * as recording from "./areas/recording";
import * as sidebar from "./areas/sidebar";
import * as onboarding from "./areas/onboarding";
import * as settings from "./areas/settings";
import * as dialogs from "./areas/dialogs";
import * as misc from "./areas/misc";
import * as meetingDetect from "./areas/meetingDetect";

const areas = [common, recording, sidebar, onboarding, settings, dialogs, misc, meetingDetect];

const en: Dict = Object.assign({}, ...areas.map((a) => a.en));
const ru: Dict = Object.assign({}, ...areas.map((a) => a.ru));

export const translations: Record<Lang, Dict> = { en, ru };
export type { Lang } from "./types";
