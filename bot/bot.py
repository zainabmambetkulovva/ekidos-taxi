import asyncio
import aiohttp
from datetime import datetime, date
import re
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage


# ===== CONFIG =====
API_TOKEN = "8829286058:AAENZzQKIK77eXNJvEzQHrH9JRbY2v9C7BM"
BACKEND_URL = "https://ekidos-taxi-production-587e.up.railway.app"

# Required recipient name on the check
REQUIRED_RECIPIENT = "Нурияз,М"

# Pricing table: payment -> balance
PRICING = {
    700: 500,
    500: 300,
    300: 150,
    100: 100,
}


# ===== FSM States =====
class Registration(StatesGroup):
    waiting_callsign = State()


class CheckSubmission(StatesGroup):
    waiting_check_text = State()


# ===== BOT SETUP =====
bot = Bot(token=API_TOKEN)
dp = Dispatcher(storage=MemoryStorage())

# In-memory: telegram_id -> callsign
driver_callsigns: dict[int, str] = {}

# Track used checks to prevent duplicates: set of file_unique_id
used_checks: set[str] = set()

# Store photo info temporarily when waiting for text
# telegram_id -> {photo_file_id, photo_unique_id}
pending_photos: dict[int, dict] = {}


# ===== HELPER FUNCTIONS =====

def validate_check_text(text: str) -> dict:
    """
    Validate the check text:
    1. Must contain 'Нурияз,М' (recipient)
    2. Must contain today's date
    Returns dict with 'valid' bool and 'error' message if invalid
    """
    if not text:
        return {"valid": False, "error": "no_text"}

    # Check recipient
    if REQUIRED_RECIPIENT not in text:
        return {
            "valid": False,
            "error": "wrong_recipient",
            "message": f"❌ Чекте алуучу '{REQUIRED_RECIPIENT}' болуш керек!\n\n"
                       f"Бул чек башка адамга түшкөн. "
                       f"Туура адамга которуңуз жана кайра жиберіңіз."
        }

    # Check today's date - try multiple date formats
    today = date.today()
    today_formats = [
        today.strftime("%d.%m.%Y"),      # 03.08.2026
        today.strftime("%d.%m.%y"),       # 03.08.26
        today.strftime("%Y-%m-%d"),       # 2026-08-03
        today.strftime("%d/%m/%Y"),       # 03/08/2026
        today.strftime("%d-%m-%Y"),       # 03-08-2026
        today.strftime("%d %m %Y"),       # 03 08 2026
        today.strftime("%-d.%m.%Y") if hasattr(today, 'strftime') else None,  # 3.08.2026
    ]
    # Also try without leading zeros
    today_formats.append(f"{today.day}.{today.month:02d}.{today.year}")  # 3.08.2026
    today_formats.append(f"{today.day:02d}.{today.month:02d}.{today.year}")  # 03.08.2026

    # Remove None values
    today_formats = [f for f in today_formats if f]

    date_found = False
    for fmt in today_formats:
        if fmt in text:
            date_found = True
            break

    if not date_found:
        return {
            "valid": False,
            "error": "wrong_date",
            "message": f"❌ Чектин датасы бүгүнкү ({today.strftime('%d.%m.%Y')}) болуш керек!\n\n"
                       f"Кечээги же эски чекти жиберүүгө болбойт.\n"
                       f"Бүгүн которуп, бүгүнкү чекти жөнөтүңүз."
        }

    return {"valid": True}


# ===== HANDLERS =====

@dp.message(Command("start"))
async def cmd_start(message: types.Message, state: FSMContext):
    telegram_id = message.from_user.id

    if telegram_id in driver_callsigns:
        callsign = driver_callsigns[telegram_id]
        await message.answer(
            f"👋 Салам! Сиз катталгансыз.\n"
            f"🆔 Позывной: {callsign}\n\n"
            f"💰 Баланс толуктоо тарифтары:\n"
            f"   700 сом = 500 баланс\n"
            f"   500 сом = 300 баланс\n"
            f"   300 сом = 150 баланс\n"
            f"   100 сом = 100 баланс\n\n"
            f"📸 Чектин СҮРӨТҮН жана ТЕКСТИН жөнөтүңүз.\n"
            f"⚠️ Чек '{REQUIRED_RECIPIENT}' атына жана бүгүнкү датада болуш керек!\n\n"
            f"🔄 /reset — позывной өзгөртүү"
        )
        return

    await state.set_state(Registration.waiting_callsign)
    await message.answer(
        "👋 Салам! Мен EKIDOS TAXI бот.\n\n"
        "📝 Позывной номериңизди жазыңыз (мисалы: 003):"
    )


@dp.message(Registration.waiting_callsign)
async def process_callsign(message: types.Message, state: FSMContext):
    callsign = message.text.strip()

    if not callsign or len(callsign) > 10:
        await message.answer("❌ Туура эмес. Кайра жазыңыз (мисалы: 003):")
        return

    telegram_id = message.from_user.id
    driver_callsigns[telegram_id] = callsign
    await state.clear()

    await message.answer(
        f"✅ Позывной: {callsign} сакталды!\n\n"
        f"💰 Баланс толуктоо тарифтары:\n"
        f"   700 сом = 500 баланс\n"
        f"   500 сом = 300 баланс\n"
        f"   300 сом = 150 баланс\n"
        f"   100 сом = 100 баланс\n\n"
        f"📸 Чектин СҮРӨТҮН жөнөтүңүз.\n"
        f"⚠️ Чек '{REQUIRED_RECIPIENT}' атына жана бүгүнкү датада болуш керек!\n\n"
        f"💡 Сүрөттүн caption'уна же жооп кат менен чектеги текстти жазыңыз."
    )


@dp.message(Command("balance"))
async def cmd_balance(message: types.Message):
    telegram_id = message.from_user.id
    callsign = driver_callsigns.get(telegram_id)
    if not callsign:
        await message.answer("❌ Алдыменен /start басыңыз.")
        return
    await message.answer(
        f"💰 Позывной: {callsign}\n"
        f"Балансыңызды приложениядан караңыз."
    )


@dp.message(Command("reset"))
async def cmd_reset(message: types.Message, state: FSMContext):
    telegram_id = message.from_user.id
    driver_callsigns.pop(telegram_id, None)
    pending_photos.pop(telegram_id, None)
    await state.set_state(Registration.waiting_callsign)
    await message.answer("🔄 Позывной түрмөлдү. Жаңы позывной жазыңыз:")


@dp.message(F.photo)
async def handle_photo(message: types.Message, state: FSMContext):
    telegram_id = message.from_user.id
    callsign = driver_callsigns.get(telegram_id)
    driver_name = message.from_user.full_name

    if not callsign:
        await message.answer("❌ Алдыменен /start басыңыз.")
        return

    photo = message.photo[-1]
    file_unique_id = photo.file_unique_id

    # ===== CHECK 1: Duplicate check =====
    if file_unique_id in used_checks:
        await message.answer(
            "❌ Бул чек мурда жөнөтүлгөн!\n\n"
            "Бир чекти кайра-кайра жөнөтүүгө болбойт.\n"
            "Жаңы которуу жасап, жаңы чекти жөнөтүңүз."
        )
        return

    # Check if there's a caption with the photo
    caption = message.caption or ""

    if caption.strip():
        # Validate the check text from caption
        validation = validate_check_text(caption)

        if not validation["valid"]:
            if validation["error"] == "wrong_recipient":
                await message.answer(validation["message"])
                return
            elif validation["error"] == "wrong_date":
                await message.answer(validation["message"])
                return
        
        # All validations passed - proceed with sending to backend
        used_checks.add(file_unique_id)

        file_info = await bot.get_file(photo.file_id)
        photo_url = f"https://api.telegram.org/file/bot{API_TOKEN}/{file_info.file_path}"

        try:
            async with aiohttp.ClientSession() as session:
                payload = {
                    "telegramId": telegram_id,
                    "driverName": f"{driver_name} (#{callsign})",
                    "photoUrl": photo_url,
                    "callsign": callsign,
                }
                async with session.post(f"{BACKEND_URL}/api/topup", json=payload) as resp:
                    if resp.status == 200:
                        await message.answer(
                            f"✅ Запрос кабыл алынды!\n\n"
                            f"🆔 Позывной: {callsign}\n"
                            f"👤 {driver_name}\n\n"
                            f"Админ текшерип баланс салат.\n"
                            f"⏳ Күтүңүз..."
                        )
                    elif resp.status == 404:
                        # Remove from used checks since it wasn't processed
                        used_checks.discard(file_unique_id)
                        await message.answer(
                            f"❌ Сиз системада катталган эмессиз.\n"
                            f"Диспетчерге кайрылыңыз.\n"
                            f"🆔 Telegram ID: {telegram_id}"
                        )
                    else:
                        used_checks.discard(file_unique_id)
                        await message.answer("❌ Ката. Кийинчерээк кайталаңыз.")
        except Exception as e:
            used_checks.discard(file_unique_id)
            print(f"Error: {e}")
            await message.answer("❌ Сервер менен байланыш жок.")
    else:
        # No caption - save photo and ask for text
        pending_photos[telegram_id] = {
            "file_id": photo.file_id,
            "file_unique_id": file_unique_id,
        }
        await state.set_state(CheckSubmission.waiting_check_text)
        await message.answer(
            "📝 Эми чектеги ТЕКСТТИ жазыңыз же көчүрүп жиберіңіз.\n\n"
            "⚠️ Чекте төмөнкүлөр болуш керек:\n"
            f"  • Алуучу: {REQUIRED_RECIPIENT}\n"
            f"  • Дата: бүгүнкү ({date.today().strftime('%d.%m.%Y')})\n\n"
            "💡 Же чекти caption менен кошо жиберіңіз."
        )


@dp.message(CheckSubmission.waiting_check_text)
async def handle_check_text(message: types.Message, state: FSMContext):
    telegram_id = message.from_user.id
    callsign = driver_callsigns.get(telegram_id)
    driver_name = message.from_user.full_name
    text = message.text or ""

    if not callsign:
        await state.clear()
        await message.answer("❌ Алдыменен /start басыңыз.")
        return

    photo_data = pending_photos.get(telegram_id)
    if not photo_data:
        await state.clear()
        await message.answer("❌ Сүрөт табылган жок. Чектин сүрөтүн кайра жөнөтүңүз.")
        return

    # Validate check text
    validation = validate_check_text(text)

    if not validation["valid"]:
        if validation["error"] == "no_text":
            await message.answer(
                "❌ Текст жок. Чектеги текстти жазыңыз же көчүрүп жиберіңіз."
            )
            return
        elif validation["error"] == "wrong_recipient":
            await state.clear()
            pending_photos.pop(telegram_id, None)
            await message.answer(validation["message"])
            return
        elif validation["error"] == "wrong_date":
            await state.clear()
            pending_photos.pop(telegram_id, None)
            await message.answer(validation["message"])
            return

    # Check duplicate
    file_unique_id = photo_data["file_unique_id"]
    if file_unique_id in used_checks:
        await state.clear()
        pending_photos.pop(telegram_id, None)
        await message.answer(
            "❌ Бул чек мурда жөнөтүлгөн!\n\n"
            "Бир чекти кайра-кайра жөнөтүүгө болбойт.\n"
            "Жаңы которуу жасап, жаңы чекти жөнөтүңүз."
        )
        return

    # All validations passed!
    used_checks.add(file_unique_id)
    await state.clear()

    file_info = await bot.get_file(photo_data["file_id"])
    photo_url = f"https://api.telegram.org/file/bot{API_TOKEN}/{file_info.file_path}"

    try:
        async with aiohttp.ClientSession() as session:
            payload = {
                "telegramId": telegram_id,
                "driverName": f"{driver_name} (#{callsign})",
                "photoUrl": photo_url,
                "callsign": callsign,
            }
            async with session.post(f"{BACKEND_URL}/api/topup", json=payload) as resp:
                if resp.status == 200:
                    await message.answer(
                        f"✅ Запрос кабыл алынды!\n\n"
                        f"🆔 Позывной: {callsign}\n"
                        f"👤 {driver_name}\n\n"
                        f"Админ текшерип баланс салат.\n"
                        f"⏳ Күтүңүз..."
                    )
                elif resp.status == 404:
                    used_checks.discard(file_unique_id)
                    await message.answer(
                        f"❌ Сиз системада катталган эмессиз.\n"
                        f"Диспетчерге кайрылыңыз.\n"
                        f"🆔 Telegram ID: {telegram_id}"
                    )
                else:
                    used_checks.discard(file_unique_id)
                    await message.answer("❌ Ката. Кийинчерээк кайталаңыз.")
    except Exception as e:
        used_checks.discard(file_unique_id)
        print(f"Error: {e}")
        await message.answer("❌ Сервер менен байланыш жок.")
    finally:
        pending_photos.pop(telegram_id, None)


@dp.message()
async def handle_other(message: types.Message):
    telegram_id = message.from_user.id
    callsign = driver_callsigns.get(telegram_id)
    if not callsign:
        await message.answer("👋 /start басыңыз.")
    else:
        await message.answer(
            f"📸 Баланс толуктоо үчүн чектин СҮРӨТҮН жөнөтүңүз.\n\n"
            f"⚠️ Эрежелер:\n"
            f"  • Чек '{REQUIRED_RECIPIENT}' атына болуш керек\n"
            f"  • Дата бүгүнкү болуш керек\n"
            f"  • Бир чекти 1 гана жолу жөнөтүүгө болот\n\n"
            f"💰 Тарифтар:\n"
            f"   700 сом = 500 баланс\n"
            f"   500 сом = 300 баланс\n"
            f"   300 сом = 150 баланс\n"
            f"   100 сом = 100 баланс"
        )


async def main():
    await bot.delete_webhook(drop_pending_updates=True)
    print("🤖 EKIDOS TAXI Bot иштеп жатат")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
