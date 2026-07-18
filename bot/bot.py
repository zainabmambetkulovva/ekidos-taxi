import asyncio
import aiohttp
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.fsm.storage.memory import MemoryStorage


# ===== CONFIG =====
API_TOKEN = "8829286058:AAENZzQKIK77eXNJvEzQHrH9JRbY2v9C7BM"
BACKEND_URL = "https://ekidos-taxi-production.up.railway.app"


# ===== BOT SETUP =====
bot = Bot(token=API_TOKEN)
dp = Dispatcher(storage=MemoryStorage())


# ===== HANDLERS =====

@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    await message.answer(
        "👋 Салам! Мен EKIDOS TAXI бот.\n\n"
        "📸 Төлөм чегин (скриншот) жөнөтүңүз — админ текшерип балансыңызды толуктайт.\n"
        "💰 /balance — балансыңызды текшерүү"
    )


@dp.message(Command("balance"))
async def cmd_balance(message: types.Message):
    await message.answer("💰 Балансыңызды текшерүү үчүн приложениядан караңыз.")


# Айдоочудан СҮРӨТ келгенде — backend'ге topup request жиберет
@dp.message(F.photo)
async def handle_photo(message: types.Message):
    telegram_id = message.from_user.id
    driver_name = message.from_user.full_name

    # Backend'ге topup request жиберүү
    try:
        async with aiohttp.ClientSession() as session:
            payload = {
                "telegramId": telegram_id,
                "driverName": driver_name,
                "photoUrl": None,  # Сүрөттү сактоо кийин кошулат
            }
            async with session.post(f"{BACKEND_URL}/api/topup", json=payload) as resp:
                if resp.status == 200:
                    await message.answer(
                        "✅ Запросуңуз кабыл алынды!\n"
                        "Админ текшерип, балансыңызды толуктайт.\n"
                        "⏳ Күтүңүз..."
                    )
                elif resp.status == 404:
                    await message.answer(
                        "❌ Сиз системада катталган эмессиз.\n"
                        "Диспетчерге кайрылып, Telegram ID'ңизди айтыңыз:\n"
                        f"🆔 {telegram_id}"
                    )
                else:
                    await message.answer("❌ Ошибка. Кийинчерээк кайталаңыз.")
    except Exception as e:
        print(f"Error sending topup request: {e}")
        await message.answer("❌ Сервер менен байланыш жок. Кийинчерээк кайталаңыз.")


# Башка нерсе жиберсе (текст, документ) — жардам
@dp.message()
async def handle_other(message: types.Message):
    await message.answer(
        "� Баланс толуктоо үчүн төлөм чегинин СҮРӨТҮН жөнөтүңүз.\n"
        "💰 /balance — балансыңызды текшерүү"
    )


# ===== MAIN =====
async def main():
    await bot.delete_webhook(drop_pending_updates=True)
    print("🤖 EKIDOS TAXI Bot started")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())

