import { createClient } from '@supabase/supabase-js';

export async function onRequest(context) {
  const { request, env } = context;
  const { method } = request;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  // ==================== GET 请求处理 ====================
  if (method === 'GET') {
    try {
      const url = new URL(request.url);
      const action = url.searchParams.get('action'); // 🛠️ 新增：获取动作标识
      const password = url.searchParams.get('password');

      // 🌐 新增分支：如果是前端主页无密码拉取“已审核通过”的资源，直接放行
      if (action === 'get_approved') {
        const { data, error } = await supabase
          .from('resources')
          .select('*')
          .eq('status', 'approved')
          .order('created_at', { ascending: false }); // 最新审核的排在前面

        if (error) {
          return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ success: true, data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 🔒 正常分支：拉取待审核资源，必须校验密码
      if (password !== env.ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ success: false, error: '密码错误' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data, error } = await supabase
        .from('resources')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: e.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  // ==================== POST 请求处理 ====================
  if (method === 'POST') {
    try {
      const { id, password, action } = await request.json(); // 🛠️ 新增：接收 action 参数

      if (password !== env.ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ success: false, error: '密码错误' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let result;

      // ❌ 新增分支：如果前端要求 delete，则执行物理删除
      if (action === 'delete') {
        result = await supabase
          .from('resources')
          .delete()
          .eq('id', id);
      } else {
        // ✅ 正常分支：默认执行通过审核（将 status 改为 approved）
        result = await supabase
          .from('resources')
          .update({ status: 'approved' })
          .eq('id', id);
      }

      // 提取 Supabase 的错误对象
      const { error } = result;

      if (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 根据不同的 action 返回对应的成功提示语
      const successMessage = action === 'delete' ? '该资源已被拒绝并删除！' : '审核成功！';

      return new Response(JSON.stringify({ success: true, message: successMessage }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (e) {
      return new Response(JSON.stringify({ success: false, error: e.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response(JSON.stringify({ success: false, error: '不支持的请求方法' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
