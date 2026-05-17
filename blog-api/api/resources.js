const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
    const { data, error } = await supabase
      .from('resources')
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (error) return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: error.message }) };
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, data }) };
  }

  if (event.httpMethod === 'POST') {
    const { name, url, description } = JSON.parse(event.body);
    if (!name || !url) return { statusCode: 400, headers, body: JSON.stringify({ success: false, error: '名称和链接不能为空' }) };

    const { data, error } = await supabase
      .from('resources')
      .insert([{ name, url, description, status: 'pending' }]);

    if (error) return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: error.message }) };
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: '提交成功！等待审核' }) };
  }

  return { statusCode: 405, headers, body: JSON.stringify({ success: false, error: '不支持的请求方法' }) };
};
