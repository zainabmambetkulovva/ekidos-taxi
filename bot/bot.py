import asyncio
import aiohttp
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage


# ===== CONFIG =====
API_TOKEN = "8829286058:AAENZzQKIK77eXNJvEzQHrH9JRbY2v9C7BM"
BACKEND_URL = "https://ekidos-taxi-production-587e.up.railway.app"


# ===== FSM States =====
class Registration(StatesGroup):
    waiting_callsign = State()


# ===== BOT SETUP =====
bot = Bot(token=API_TOKEN)
dp = Dispatcher(storage=MemoryStorage())

# In-memory storage for driver callsigns (telegram_id -> callsign)
driver_callsigns: dict[int, str] = {}


# ===== HANDLERS =====

@dp.message(Command("start"))
async def cmd_start(message: types.Message, state: FSMContext):
    telegram_id = message.from_user.id

    # Check if already registered
    if telegram_id in driver_callsigns:
        callsign = driver_callsigns[telegram_id]
        await message.answer(
            f"\U0001F44B Salaam! Siz kattalgan, pozyvnoi: {callsign}\n\n"
            f"\U0001F4F8 Tolow chegin (screenshot) jonotiuz \u2014 admin teksheri balansynyzdy toluktat.\n"
            f"\U0001F4B0 /balance \u2014 balansyyzdy teksheriw\n"
            f"\U0001F504 /reset \u2014 pozywnoi yzgyrtiw"
        )
        return

    # Ask for callsign
    await state.set_state(Registration.waiting_callsign)
    await message.answer(
        "\U0001F44B Salaam! Men EKIDOS TAXI bot.\n\n"
        "\U0001F4DD Pozyvnoi nomerinizdi jazyyz (misaly: 003):"
    )


@dp.message(Registration.waiting_callsign)
async def process_callsign(message: types.Message, state: FSMContext):
    callsign = message.text.strip()

    if not callsign or len(callsign) > 10:
        await message.answer("\u274C Pozyvnoi tuura emes. Kaiyra jazyyz (misaly: 003):")
        return

    telegram_id = message.from_user.id
    driver_name = message.from_user.full_name

    # Save callsign locally
    driver_callsigns[telegram_id] = callsign

    # Try to link with backend (find driver by callsign and set telegramId)
    try:
        async with aiohttp.ClientSession() as session:
            # Attempt callsign login to verify driver exists
            payload = {"callsign": callsign, "password": "check_only"}
            async with session.post(f"{BACKEND_URL}/api/auth/callsign-login", json=payload) as resp:
                if resp.status == 404:
                    await message.answer(
                        f"\u274C Pozyvnoi '{callsign}' bazada tabylgan jok.\n"
                        "Dispetcherge kaiyrlyyyz."
                    )
                    driver_callsigns.pop(telegram_id, None)
                    await state.clear()
                    return
                # 401 = password wrong but callsign exists - that's fine
    except Exception:
        pass

    await state.clear()
    await message.answer(
        f"\u2705 Pozyvnoi: {callsign} saktaldi!\n\n"
        f"\U0001F4F8 Endi tolow chegin (screenshot) jonotiuz.\n"
        f"Admin teksheri balansynyzdy toluktat.\n\n"
        f"\U0001F4B0 /balance \u2014 balans teksheriw"
    )


@dp.message(Command("balance"))
async def cmd_balance(message: types.Message):
    telegram_id = message.from_user.id
    callsign = driver_callsigns.get(telegram_id)

    if not callsign:
        await message.answer("\u274C Aldymenen /start basyyz jana pozyvnoi jazyyz.")
        return

    # Try to get balance from backend
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{BACKEND_URL}/api/orders/online-drivers") as resp:
                pass  # We can't easily get balance without auth
    except Exception:
        pass

    await message.answer(
        f"\U0001F4B0 Pozyvnoi: {callsign}\n"
        "Balansynyzdy prilojeniyadan karanyyz.\n"
        "Balans toluktoonu admin adminuudalat."
    )


@dp.message(Command("reset"))
async def cmd_reset(message: types.Message, state: FSMContext):
    telegram_id = message.from_user.id
    driver_callsigns.pop(telegram_id, None)
    await state.set_state(Registration.waiting_callsign)
    await message.answer("\U0001F504 Pozyvnoi tyrmaldi. Jana pozywnoi jazyyz:")


# Photo handler - driver sends receipt screenshot
@dp.message(F.photo)
async def handle_photo(message: types.Message):
    telegram_id = message.from_user.id
    callsign = driver_callsigns.get(telegram_id)
    driver_name = message.from_user.full_name

    if not callsign:
        await message.answer(
            "\u274C Aldymenen /start basyyz jana pozyvnoi jazyyz."
        )
        return

    # Get photo file URL
    photo = message.photo[-1]  # highest resolution
    file_info = await bot.get_file(photo.file_id)
    photo_url = f"https://api.telegram.org/file/bot{API_TOKEN}/{file_info.file_path}"

    # Send topup request to backend
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
                        f"\u2705 Zapros kabyl alyndy!\n\n"
                        f"\U0001F194 Pozyvnoi: {callsign}\n"
                        f"\U0001F464 {driver_name}\n\n"
                        f"Admin teksheri balansyyzdy toluktait.\n"
                        "\u23F3 Kiitiiniiz..."
                    )
                elif resp.status == 404:
                    await message.answer(
                        f"\u274C Siz sistemada kattalgan emessiz.\n"
                        f"Dispetcherge kaiyrlyyyz.\n"
                        f"\U0001F194 Telegram ID: {telegram_id}\n"
                        f"Pozyvnoi: {callsign}"
                    )
                else:
                    error_text = await resp.text()
                    await message.answer(f"\u274C Kata. Kiiyincherlek kaiytalayyz. ({resp.status})")
    except Exception as e:
        print(f"Error sending topup request: {e}")
        await message.answer("\u274C Server menen baiylanysh jok. Kiiyincherlek kaiytalayyz.")


# Other messages
@dp.message()
async def handle_other(message: types.Message):
    telegram_id = message.from_user.id
    callsign = driver_callsigns.get(telegram_id)

    if not callsign:
        await message.answer(
            "\U0001F44B /start basyyz jana pozyvnoi jazyyz."
        )
    else:
        await message.answer(
            f"\U0001F4F8 Balans toluktoonu iin tolow chegindin SIROTIN jonotiuz.\n"
            f"\U0001F4B0 /balance \u2014 balans teksheriw\n"
            f"\U0001F504 /reset \u2014 pozywnoi yzgyrtiw"
        )


# ===== MAIN =====
async def main():
    await bot.delete_webhook(drop_pending_updates=True)
    print("\U0001F916 EKIDOS TAXI Bot started")
    print(f"Backend: {BACKEND_URL}")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
