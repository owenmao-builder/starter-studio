import mammoth from 'mammoth';
import { AppError } from './store';
export async function parseUpload(file:File){
 if(file.size>10*1024*1024)throw new AppError('FILE_TOO_LARGE','文件不能超过 10 MB');
 if(file.size===0)throw new AppError('EMPTY_FILE','文件为空，请选择包含需求的 PRD');
 const ext=file.name.toLowerCase().split('.').pop();
 if(!['md','txt','pdf','docx'].includes(ext || ''))throw new AppError('UNSUPPORTED_FILE','支持 Markdown、TXT、PDF 和 Word（.docx）文件');
 const bytes=Buffer.from(await file.arrayBuffer());let text='';
 try{
  if(ext==='pdf'){
   if(bytes.subarray(0,5).toString()!=='%PDF-')throw new AppError('INVALID_FILE','文件内容不是有效的 PDF');
   const {PDFParse}=await import('pdf-parse');const parser=new PDFParse({data:bytes});
   try{text=(await parser.getText()).text;}finally{await parser.destroy();}
  }else if(ext==='docx'){
   if(bytes[0]!==0x50||bytes[1]!==0x4b)throw new AppError('INVALID_FILE','文件内容不是有效的 Word 文档');
   text=(await mammoth.extractRawText({buffer:bytes})).value;
  }else{
   text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
   if(text.includes('\0'))throw new AppError('INVALID_FILE','请上传 UTF-8 文本文件');
  }
 }catch(e){if(e instanceof AppError)throw e;throw new AppError('PARSE_FAILED','无法读取此文档，请导出为 UTF-8 Markdown 或 TXT 后重试');}
 if(text.trim().length<20)throw new AppError('TOO_SHORT','文档内容过少。扫描版 PDF 请先转成可复制文字的文档');
 if(text.length>200000)throw new AppError('TOO_LONG','文档内容超过 20 万字，请精简后重试');
 const filename=file.name.replace(/[\\/\x00-\x1f]/g,'_').slice(0,160);
 return {filename,text:text.trim()};
}
