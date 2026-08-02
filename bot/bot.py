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


# ===== BOT SETUP =====
bot = Bot(token=API_TOKEN)
dp = Dispatcher(storage=MemoryStorage())

# In-memory: telegram_id -> callsign
driver_callsigns: dict[int, str] = {}


# ===== HANDLERS =====

@dp.message(Command("start"))
async def cmd_start(message: types.Message, state: FSMContext):
    telegram_id = message.from_user.id

    if telegram_id in driver_callsigns:
        callsign = driver_callsigns[telegram_id]
        await message.answer(
            f"\U0001F44B \u0421\u0430\u043B\u0430\u043C! \u0421\u0438\u0437 \u043A\u0430\u0442\u0442\u0430\u043B\u0433\u0430\u043D\u0441\u044B\u0437.\n"
            f"\U0001F194 \u041F\u043E\u0437\u044B\u0432\u043D\u043E\u0439: {callsign}\n\n"
            f"\U0001F4B0 \u0411\u0430\u043B\u0430\u043D\u0441 \u0442\u043E\u043B\u0443\u043A\u0442\u043E\u043E \u0442\u0430\u0440\u0438\u0444\u0442\u0430\u0440\u044B:\n"
            f"   700 \u0441\u043E\u043C = 500 \u0431\u0430\u043B\u0430\u043D\u0441\n"
            f"   500 \u0441\u043E\u043C = 300 \u0431\u0430\u043B\u0430\u043D\u0441\n"
            f"   300 \u0441\u043E\u043C = 150 \u0431\u0430\u043B\u0430\u043D\u0441\n"
            f"   100 \u0441\u043E\u043C = 100 \u0431\u0430\u043B\u0430\u043D\u0441\n\n"
            f"\U0001F4F8 \u0427\u0435\u043A\u0442\u0438\u043D \u0421\u04AE\u0420\u04E8\u0422\u04AE\u043D \u0436\u04E9\u043D\u04E9\u0442\u04AF\u04A3\u04AF\u0437.\n"
            f"\U0001F504 /reset \u2014 \u043F\u043E\u0437\u044B\u0432\u043D\u043E\u0439 \u04E9\u0437\u0433\u04E9\u0440\u0442\u04AF\u04AF"
        )
        return

    await state.set_state(Registration.waiting_callsign)
    await message.answer(
        "\U0001F44B \u0421\u0430\u043B\u0430\u043C! \u041C\u0435\u043D EKIDOS TAXI \u0431\u043E\u0442.\n\n"
        "\U0001F4DD \u041F\u043E\u0437\u044B\u0432\u043D\u043E\u0439 \u043D\u043E\u043C\u0435\u0440\u0438\u04A3\u0438\u0437\u0434\u0438 \u0436\u0430\u0437\u044B\u04A3\u044B\u0437 (\u043C\u0438\u0441\u0430\u043B\u044B: 003):"
    )


@dp.message(Registration.waiting_callsign)
async def process_callsign(message: types.Message, state: FSMContext):
    callsign = message.text.strip()

    if not callsign or len(callsign) > 10:
        await message.answer("\u274C \u0422\u0443\u0443\u0440\u0430 \u044D\u043C\u0435\u0441. \u041A\u0430\u0439\u0440\u0430 \u0436\u0430\u0437\u044B\u04A3\u044B\u0437 (\u043C\u0438\u0441\u0430\u043B\u044B: 003):")
        return

    telegram_id = message.from_user.id
    driver_callsigns[telegram_id] = callsign
    await state.clear()

    await message.answer(
        f"\u2705 \u041F\u043E\u0437\u044B\u0432\u043D\u043E\u0439: {callsign} \u0441\u0430\u043A\u0442\u0430\u043B\u0434\u044B!\n\n"
        f"\U0001F4B0 \u0411\u0430\u043B\u0430\u043D\u0441 \u0442\u043E\u043B\u0443\u043A\u0442\u043E\u043E \u0442\u0430\u0440\u0438\u0444\u0442\u0430\u0440\u044B:\n"
        f"   700 \u0441\u043E\u043C = 500 \u0431\u0430\u043B\u0430\u043D\u0441\n"
        f"   500 \u0441\u043E\u043C = 300 \u0431\u0430\u043B\u0430\u043D\u0441\n"
        f"   300 \u0441\u043E\u043C = 150 \u0431\u0430\u043B\u0430\u043D\u0441\n"
        f"   100 \u0441\u043E\u043C = 100 \u0431\u0430\u043B\u0430\u043D\u0441\n\n"
        f"\U0001F4F8 \u0427\u0435\u043A\u0442\u0438\u043D \u0421\u04AE\u0420\u04E8\u0422\u04AE\u043D \u0436\u04E9\u043D\u04E9\u0442\u04AF\u04A3\u04AF\u0437 \u2014 \u0430\u0434\u043C\u0438\u043D \u0442\u0435\u043A\u0448\u0435\u0440\u0438\u043F \u0431\u0430\u043B\u0430\u043D\u0441 \u0441\u0430\u043B\u0430\u0442."
    )


@dp.message(Command("balance"))
async def cmd_balance(message: types.Message):
    telegram_id = message.from_user.id
    callsign = driver_callsigns.get(telegram_id)
    if not callsign:
        await message.answer("\u274C \u0410\u043B\u0434\u044B\u043C\u0435\u043D\u0435\u043D /start \u0431\u0430\u0441\u044B\u04A3\u044B\u0437.")
        return
    await message.answer(
        f"\U0001F4B0 \u041F\u043E\u0437\u044B\u0432\u043D\u043E\u0439: {callsign}\n"
        f"\u0411\u0430\u043B\u0430\u043D\u0441\u044B\u04A3\u044B\u0437\u0434\u044B \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u044F\u0434\u0430\u043D \u043A\u0430\u0440\u0430\u04A3\u044B\u0437."
    )


@dp.message(Command("reset"))
async def cmd_reset(message: types.Message, state: FSMContext):
    telegram_id = message.from_user.id
    driver_callsigns.pop(telegram_id, None)
    await state.set_state(Registration.waiting_callsign)
    await message.answer("\U0001F504 \u041F\u043E\u0437\u044B\u0432\u043D\u043E\u0439 \u0442\u04AF\u0440\u043C\u04E9\u043B\u0434\u04AF. \u0416\u0430\u04A3\u044B \u043F\u043E\u0437\u044B\u0432\u043D\u043E\u0439 \u0436\u0430\u0437\u044B\u04A3\u044B\u0437:")


@dp.message(F.photo)
async def handle_photo(message: types.Message):
    telegram_id = message.from_user.id
    callsign = driver_callsigns.get(telegram_id)
    driver_name = message.from_user.full_name

    if not callsign:
        await message.answer("\u274C \u0410\u043B\u0434\u044B\u043C\u0435\u043D\u0435\u043D /start \u0431\u0430\u0441\u044B\u04A3\u044B\u0437.")
        return

    photo = message.photo[-1]
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
                        f"\u2705 \u0417\u0430\u043F\u0440\u043E\u0441 \u043A\u0430\u0431\u044B\u043B \u0430\u043B\u044B\u043D\u0434\u044B!\n\n"
                        f"\U0001F194 \u041F\u043E\u0437\u044B\u0432\u043D\u043E\u0439: {callsign}\n"
                        f"\U0001F464 {driver_name}\n\n"
                        f"\u0410\u0434\u043C\u0438\u043D \u0442\u0435\u043A\u0448\u0435\u0440\u0438\u043F \u0431\u0430\u043B\u0430\u043D\u0441 \u0441\u0430\u043B\u0430\u0442.\n"
                        f"\u23F3 \u041A\u04AF\u0442\u04AF\u04A3\u04AF\u0437..."
                    )
                elif resp.status == 404:
                    await message.answer(
                        f"\u274C \u0421\u0438\u0437 \u0441\u0438\u0441\u0442\u0435\u043C\u0430\u0434\u0430 \u043A\u0430\u0442\u0442\u0430\u043B\u0433\u0430\u043D \u044D\u043C\u0435\u0441\u0441\u0438\u0437.\n"
                        f"\u0414\u0438\u0441\u043F\u0435\u0442\u0447\u0435\u0440\u0433\u0435 \u043A\u0430\u0439\u0440\u044B\u043B\u044B\u04A3\u044B\u0437.\n"
                        f"\U0001F194 Telegram ID: {telegram_id}"
                    )
                else:
                    await message.answer("\u274C \u041A\u0430\u0442\u0430. \u041A\u0438\u0439\u0438\u043D\u0447\u0435\u0440\u04E9\u04E9\u043A \u043A\u0430\u0439\u0442\u0430\u043B\u0430\u04A3\u044B\u0437.")
    except Exception as e:
        print(f"Error: {e}")
        await message.answer("\u274C \u0421\u0435\u0440\u0432\u0435\u0440 \u043C\u0435\u043D\u0435\u043D \u0431\u0430\u0439\u043B\u0430\u043D\u044B\u0448 \u0436\u043E\u043A.")


@dp.message()
async def handle_other(message: types.Message):
    telegram_id = message.from_user.id
    callsign = driver_callsigns.get(telegram_id)
    if not callsign:
        await message.answer("\U0001F44B /start \u0431\u0430\u0441\u044B\u04A3\u044B\u0437.")
    else:
        await message.answer(
            f"\U0001F4F8 \u0411\u0430\u043B\u0430\u043D\u0441 \u0442\u043E\u043B\u0443\u043A\u0442\u043E\u043E \u04AF\u0447\u04AF\u043D \u0447\u0435\u043A\u0442\u0438\u043D \u0421\u04AE\u0420\u04E8\u0422\u04AE\u043D \u0436\u04E9\u043D\u04E9\u0442\u04AF\u04A3\u04AF\u0437.\n\n"
            f"\U0001F4B0 \u0422\u0430\u0440\u0438\u0444\u0442\u0430\u0440:\n"
            f"   700 \u0441\u043E\u043C = 500 \u0431\u0430\u043B\u0430\u043D\u0441\n"
            f"   500 \u0441\u043E\u043C = 300 \u0431\u0430\u043B\u0430\u043D\u0441\n"
            f"   300 \u0441\u043E\u043C = 150 \u0431\u0430\u043B\u0430\u043D\u0441\n"
            f"   100 \u0441\u043E\u043C = 100 \u0431\u0430\u043B\u0430\u043D\u0441"
        )


async def main():
    await bot.delete_webhook(drop_pending_updates=True)
    print("\U0001F916 EKIDOS TAXI Bot \u0438\u0448\u0442\u0435\u043F \u0436\u0430\u0442\u0430\u0442")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
