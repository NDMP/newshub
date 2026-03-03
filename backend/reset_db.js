const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function wipe() {
    console.log("Wiping articles...");
    const { data, error } = await supabase
        .from('articles')
        .delete()
        .neq('id', 0); // Deletes all records since id is > 0

    if (error) console.error("Error wiping articles:", error);
    else console.log("Successfully wiped all old articles.");
}
wipe();
