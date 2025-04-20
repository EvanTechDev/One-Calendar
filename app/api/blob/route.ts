import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

// 从环境变量中获取 Supabase 的 URL 和密钥
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

// 处理上传备份的 POST 请求
async function handleUpload(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    // 解析上传的文件
    const file = req.body.file;

    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // 上传文件到 Supabase Storage
    const { data, error } = await supabase
      .storage
      .from('backups') // 存储桶名称
      .upload(`backup-${Date.now()}.json`, file);

    if (error) {
      throw new Error('Upload failed: ' + error.message);
    }

    return res.status(200).json({ message: 'Backup uploaded successfully', data });
  } catch (error) {
    console.error('Error uploading backup:', error);
    return res.status(500).json({ message: 'Error uploading backup', error: error.message });
  }
}

// 处理获取备份文件的 GET 请求
async function handleGetBackup(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { fileName } = req.query;

  if (!fileName || typeof fileName !== 'string') {
    return res.status(400).json({ message: 'No file name provided' });
  }

  try {
    // 从 Supabase Storage 下载指定的备份文件
    const { data, error } = await supabase
      .storage
      .from('backups')
      .download(fileName);

    if (error) {
      throw new Error('Download failed: ' + error.message);
    }

    // 解析文件内容 (假设备份文件是 JSON 格式)
    const text = await data.text();
    const backupData = JSON.parse(text);

    return res.status(200).json({ message: 'Backup restored successfully', data: backupData });
  } catch (error) {
    console.error('Error restoring backup:', error);
    return res.status(500).json({ message: 'Error restoring backup', error: error.message });
  }
}

// 主 API 路由处理函数
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    return await handleUpload(req, res);
  } else if (req.method === 'GET') {
    return await handleGetBackup(req, res);
  } else {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }
}
