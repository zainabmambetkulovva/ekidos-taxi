"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = void 0;
exports.uploadToStorage = uploadToStorage;
exports.deleteFromStorage = deleteFromStorage;
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const hasSupabase = supabaseUrl.length > 10 && !supabaseUrl.includes('[YOUR');
let supabase = null;
exports.supabase = supabase;
if (hasSupabase) {
    exports.supabase = supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}
async function uploadToStorage(bucket, path, file, contentType) {
    if (!supabase)
        return null;
    const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file, { contentType, upsert: true });
    if (error) {
        console.error('Storage upload error:', error.message);
        return null;
    }
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
    return urlData.publicUrl;
}
async function deleteFromStorage(bucket, path) {
    if (!supabase)
        return false;
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) {
        console.error('Storage delete error:', error.message);
        return false;
    }
    return true;
}
