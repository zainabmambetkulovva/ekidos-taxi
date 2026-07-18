import asyncio
import asyncpg
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage


# ===== CONFIG =====
API_TOKEN = "8829286058:AAENZzQKIK77eXNJvEzQHrH9JRbY2v9C7BM"
ADMIN_ID = "7510511621"
DATABASE_URL = "postgresql://postgres.uikgnyoosdzgriuareih:210811zainabb@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres"


# ===== DATABASE =====
pool: asyncpg.Pool | None = None


async def init_db():
    """Базага туташуу пулун түзүү"""
    global pool
    pool = await asyncpg.create_pool(
        dsn=DATABASE_URL,
        min_size=2,
        max_size=10,
    )
    # drivers таблицасында balance колонкасы бар экенин текшерүү, жок болсо кошуу
    async with pool.acquire() as conn:
        await conn.execute("""
            ALTER TABLE drivers ADD COLUMN IF NOT EXISTS balance FLOAT DEFAULT 0;
        """)
        await conn.execute("""
            ALTER TABLE drivers ADD COLUMN IF NOT EXISTS telegram_id BIGINT;
        """)
    print("✅ Database connected")


async def update_driver_balance(telegram_id: int, amount: float) -> float | None:
    """
    Айдоочунун балансын толуктоо.
    Returns: жаңы баланс же None (айдоочу табылган жок)
    """
    query = """
        UPDATE drivers
        SET balance = balance + $1
        WHERE telegram_id = $2
        RETURNING balance;
    """
    async with pool.acquire() as conn:
        return await conn.fetchval(query, amount, telegram_id)


async def get_driver_balance(telegram_id: int) -> float | None:
    """Айдоочунун учурдагы балансын алуу"""
    query = "SELECT balance FROM drivers WHERE telegram_id = $1;"
    async with pool.acquire() as conn:
        return await conn.fetchval(query, telegram_id)


async def get_driver_name(telegram_id: int) -> str | None:
    """Айдоочунун атын алуу"""
    query = """SELECT "firstName" || ' ' || "lastName" as name FROM drivers WHERE telegram_id = $1;"""
    async with pool.acquire() as conn:
        return await conn.fetchval(query, telegram_id)


# ===== FSM STATES =====
class TopUpState(StatesGroup):
    waiting_for_amount = State()


# ===== BOT SETUP =====
bot = Bot(token=API_TOKEN)
dp = Dispatcher(storage=MemoryStorage())


# ===== HANDLERS =====

@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    await message.answer(
        "👋 Салам! Мен EKIDOS TAXI бот.\n\n"
        "📸 Төлөм чегин жөнөтүңүз — админ текшерип балансыңызды толуктайт.\n"
        "💰 /balance — балансыңызды текшерүү"
    )


@dp.message(Command("balance"))
async def cmd_balance(message: types.Message):
    balance = await get_driver_balance(message.from_user.id)
    if balance is not None:
        await message.answer(f"💰 Сиздин балансыңыз: {balance:.0f} сом")
    else:
        await message.answer("❌ Сиз системада катталган эмессиз. Диспетчерге кайрылыңыз.")


# Айдоочудан сүрөт/чек келгенде
@dp.message(F.photo)
async def handle_photo(message: types.Message):
    keyboard = types.InlineKeyboardMarkup(inline_keyboard=[
        [types.InlineKeyboardButton(
            text="✅ Балансты толуктоо",
            callback_data=f"approve_{message.from_user.id}"
        )]
    ])
    await bot.send_photo(
        chat_id=ADMIN_ID,
        photo=message.photo[-1].file_id,
        caption=(
            f"📸 Төлөм чеги\n"
            f"👤 Айдоочу: {message.from_user.full_name}\n"
            f"🆔 Telegram ID: {message.from_user.id}\n\n"
            f"Текшерип, баскычты басыңыз."
        ),
        reply_markup=keyboard
    )
    await message.answer("✅ Чек кабыл алынды. Админ текшерип жатат...")


# Админ баскычты басканда сумманы суроо
@dp.callback_query(F.data.startswith("approve_"))
async def ask_amount(callback: types.CallbackQuery, state: FSMContext):
    driver_id = int(callback.data.split("_")[1])
    await state.update_data(driver_id=driver_id)
    await state.set_state(TopUpState.waiting_for_amount)

    driver_name = await get_driver_name(driver_id)
    name_text = f" ({driver_name})" if driver_name else ""

    await callback.message.answer(
        f"💰 Айдоочу ID: {driver_id}{name_text}\n"
        f"Канча сом толуктоо керек? Сумманы жазыңыз:"
    )
    await callback.answer()


# Админ сумманы жазганда балансты кошуу
@dp.message(TopUpState.waiting_for_amount)
async def process_topup(message: types.Message, state: FSMContext):
    # Сумманы текшерүү
    try:
        amount = float(message.text.strip())
        if amount <= 0:
            raise ValueError
    except ValueError:
        await message.answer("❌ Туура сумма жазыңыз (мис: 500)")
        return

    data = await state.get_data()
    driver_id = data['driver_id']

    # Базадагы балансты жаңыртуу
    new_balance = await update_driver_balance(driver_id, amount)

    if new_balance is not None:
        await message.answer(
            f"✅ Баланс толукталды!\n"
            f"👤 Айдоочу ID: {driver_id}\n"
            f"💰 Кошулду: +{amount:.0f} сом\n"
            f"📊 Жаңы баланс: {new_balance:.0f} сом"
        )
        # Айдоочуга кабарлоо
        try:
            await bot.send_message(
                driver_id,
                f"🎉 Балансыңыз толукталды!\n"
                f"💰 +{amount:.0f} сом\n"
                f"📊 Учурдагы баланс: {new_balance:.0f} сом"
            )
        except Exception:
            pass  # Айдоочу ботту блоктогон болушу мүмкүн
    else:
        await message.answer(
            f"❌ Айдоочу табылган жок (Telegram ID: {driver_id}).\n"
            f"Айдоочунун профилинде Telegram ID коюлганын текшериңиз."
        )

    await state.clear()


# ===== MAIN =====
async def main():
    await init_db()
    print("🤖 EKIDOS TAXI Bot started")
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
