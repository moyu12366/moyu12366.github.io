const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod === 'GET') {
    const password = event.headers['x-admin-password'];
    if (password !== ADMIN_PASSWORD) return { statusCode: 401, headers, body: JSON.stringify({ success: false, error: '密码错误' }) };

    const { data, error } = await supabase
      .from('resources')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: error.message }) };
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, data }) };
  }

  if (event.httpMethod === 'POST') {
    const { id, password } = JSON.parse(event.body);
    if (password !== ADMIN_PASSWORD) return { statusCode: 401, headers, body: JSON.stringify({ success: false, error: '密码错误' }) };

    const { data, error } = await supabase
      .from('resources')
      .update({ status: 'approved' })
      .eq('id', id);

    if (error) return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: error.message }) };
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: '审核成功！' }) };
  }

  return { statusCode: 405, headers, body: JSON.stringify({ success: false, error: '不支持的请求方法' }) };
};
