// xlsx-io.js — dependency-free XLSX/CSV read + write for the LVRS journal.
// Reads .xlsx (zip+XML) and .csv into a string matrix; writes a valid .xlsx (stored/no-compress).

// ---------- shared helpers ----------
function colLetter(i){ let s=''; i++; while(i>0){ const r=(i-1)%26; s=String.fromCharCode(65+r)+s; i=(i-r-1)/26; } return s; }
function colToIndex(ref){ const m=ref.match(/[A-Z]+/)[0]; let n=0; for(let k=0;k<m.length;k++) n=n*26+(m.charCodeAt(k)-64); return n-1; }
function xmlDecode(s){ return s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&#x?[0-9a-fA-F]+;/g,(m)=>{ const h=/x/i.test(m); const n=parseInt(m.replace(/[^0-9a-fA-F]/g,''),h?16:10); return isNaN(n)?m:String.fromCharCode(n); }); }
function xmlEscape(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ---------- ZIP read ----------
function u16(b,o){ return b[o]|(b[o+1]<<8); }
function u32(b,o){ return (b[o]|(b[o+1]<<8)|(b[o+2]<<16)|(b[o+3]<<24))>>>0; }
async function inflateRaw(data){ const ds=new DecompressionStream('deflate-raw'); const w=ds.writable.getWriter(); w.write(data); w.close(); const ab=await new Response(ds.readable).arrayBuffer(); return new Uint8Array(ab); }

async function unzip(bytes){
  let eocd=-1; for(let i=bytes.length-22;i>=0;i--){ if(u32(bytes,i)===0x06054b50){ eocd=i; break; } }
  if(eocd<0) throw new Error('Not a valid zip/xlsx file.');
  const cdOff=u32(bytes,eocd+16), cdCount=u16(bytes,eocd+10);
  let p=cdOff; const dir=[];
  for(let i=0;i<cdCount;i++){
    const nameLen=u16(bytes,p+28), extraLen=u16(bytes,p+30), commentLen=u16(bytes,p+32), lho=u32(bytes,p+42);
    const name=new TextDecoder().decode(bytes.slice(p+46,p+46+nameLen));
    dir.push({name,lho}); p+=46+nameLen+extraLen+commentLen;
  }
  const files={};
  for(const e of dir){
    const lp=e.lho, method=u16(bytes,lp+8), nameLen=u16(bytes,lp+26), extraLen=u16(bytes,lp+28), cSize=u32(bytes,lp+18);
    const start=lp+30+nameLen+extraLen; const comp=bytes.slice(start,start+cSize);
    files[e.name]= method===0 ? new TextDecoder().decode(comp) : new TextDecoder().decode(await inflateRaw(comp));
  }
  return files;
}

// ---------- XLSX read → matrix ----------
async function readXlsx(bytes){
  const files=await unzip(bytes);
  // shared strings
  const sst=[];
  const ssXml=files['xl/sharedStrings.xml'];
  if(ssXml){ for(const m of ssXml.matchAll(/<si>(.*?)<\/si>/gs)){ const ts=[...m[1].matchAll(/<t[^>]*>(.*?)<\/t>/gs)].map(x=>x[1]); sst.push(xmlDecode(ts.join(''))); } }
  // first worksheet (follow workbook rels, else sheet1)
  let sheetPath='xl/worksheets/sheet1.xml';
  if(!files[sheetPath]){ const k=Object.keys(files).find(n=>/^xl\/worksheets\/.*\.xml$/.test(n)); if(k) sheetPath=k; }
  const xml=files[sheetPath]||'';
  const rows=[]; let maxCol=0;
  for(const r of xml.matchAll(/<row[^>]*r="(\d+)"[^>]*>(.*?)<\/row>/gs)){
    const rowIdx=parseInt(r[1])-1; const arr=[];
    for(const c of r[2].matchAll(/<c r="([A-Z]+\d+)"([^>]*)>(.*?)<\/c>/gs)){
      const ci=colToIndex(c[1]); const attrs=c[2]||''; const inner=c[3]||'';
      const t=(attrs.match(/t="([^"]*)"/)||[])[1];
      let val='';
      if(t==='s'){ const v=(inner.match(/<v>(.*?)<\/v>/s)||[])[1]; val=sst[parseInt(v)]??''; }
      else if(t==='inlineStr'){ const ts=[...inner.matchAll(/<t[^>]*>(.*?)<\/t>/gs)].map(x=>x[1]); val=xmlDecode(ts.join('')); }
      else if(t==='str'){ const v=(inner.match(/<v>(.*?)<\/v>/s)||[])[1]||''; val=xmlDecode(v); }
      else { const v=(inner.match(/<v>(.*?)<\/v>/s)||[])[1]; val=v===undefined?'':v; }
      arr[ci]=val; if(ci>maxCol) maxCol=ci;
    }
    rows[rowIdx]=arr;
  }
  // normalize ragged matrix
  const out=[];
  for(let i=0;i<rows.length;i++){ const a=rows[i]||[]; const row=[]; for(let c=0;c<=maxCol;c++) row[c]=a[c]==null?'':a[c]; out.push(row); }
  return out;
}

// ---------- CSV read ----------
function readCsv(text){
  const rows=[]; let row=[], cur='', q=false;
  for(let i=0;i<text.length;i++){ const ch=text[i];
    if(q){ if(ch==='"'){ if(text[i+1]==='"'){ cur+='"'; i++; } else q=false; } else cur+=ch; }
    else { if(ch==='"') q=true; else if(ch===','){ row.push(cur); cur=''; } else if(ch==='\n'){ row.push(cur); rows.push(row); row=[]; cur=''; } else if(ch==='\r'){} else cur+=ch; }
  }
  if(cur!==''||row.length){ row.push(cur); rows.push(row); }
  return rows;
}

// ---------- public: read any spreadsheet → matrix ----------
export async function readSpreadsheet(file){
  const buf=await file.arrayBuffer(); const bytes=new Uint8Array(buf);
  if(bytes[0]===0x50 && bytes[1]===0x4b) return await readXlsx(bytes);      // 'PK' → xlsx
  return readCsv(new TextDecoder().decode(bytes));
}

// ---------- ZIP write (stored, no compression) ----------
const CRC=(()=>{ const t=[]; for(let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c=c&1?(0xEDB88320^(c>>>1)):(c>>>1); t[n]=c>>>0; } return t; })();
function crc32(b){ let c=0xFFFFFFFF; for(let i=0;i<b.length;i++) c=CRC[(c^b[i])&0xFF]^(c>>>8); return (c^0xFFFFFFFF)>>>0; }
function concat(arrs){ let len=0; for(const a of arrs) len+=a.length; const out=new Uint8Array(len); let o=0; for(const a of arrs){ out.set(a,o); o+=a.length; } return out; }
function w16(n){ return new Uint8Array([n&255,(n>>8)&255]); }
function w32(n){ return new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]); }

function zipStore(entries){
  const enc=new TextEncoder(); const locals=[], centrals=[]; let offset=0;
  for(const e of entries){
    const name=enc.encode(e.name); const data=typeof e.data==='string'?enc.encode(e.data):e.data; const crc=crc32(data);
    const local=concat([w32(0x04034b50),w16(20),w16(0),w16(0),w16(0),w16(0),w32(crc),w32(data.length),w32(data.length),w16(name.length),w16(0),name,data]);
    locals.push(local);
    centrals.push(concat([w32(0x02014b50),w16(20),w16(20),w16(0),w16(0),w16(0),w16(0),w32(crc),w32(data.length),w32(data.length),w16(name.length),w16(0),w16(0),w16(0),w16(0),w32(0),w32(offset),name]));
    offset+=local.length;
  }
  const cd=concat(centrals);
  const eocd=concat([w32(0x06054b50),w16(0),w16(0),w16(entries.length),w16(entries.length),w32(cd.length),w32(offset),w16(0)]);
  return new Blob([concat(locals),cd,eocd],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}

// ---------- public: matrix → xlsx Blob ----------
export function writeXlsx(matrix, sheetName){
  sheetName=sheetName||'Journal';
  let rowsXml='';
  for(let r=0;r<matrix.length;r++){
    const row=matrix[r]||[]; let cells='';
    for(let c=0;c<row.length;c++){
      let v=row[c]; if(v===''||v==null) continue;
      const ref=colLetter(c)+(r+1);
      const numeric=(typeof v==='number') || (/^-?\d+(\.\d+)?$/.test(String(v)) && String(v).trim()!=='');
      if(numeric) cells+='<c r="'+ref+'"><v>'+v+'</v></c>';
      else cells+='<c r="'+ref+'" t="inlineStr"><is><t xml:space="preserve">'+xmlEscape(v)+'</t></is></c>';
    }
    rowsXml+='<row r="'+(r+1)+'">'+cells+'</row>';
  }
  const sheet='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+rowsXml+'</sheetData></worksheet>';
  const ct='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>';
  const rels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
  const wb='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="'+xmlEscape(sheetName)+'" sheetId="1" r:id="rId1"/></sheets></workbook>';
  const wbRels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>';
  return zipStore([
    {name:'[Content_Types].xml', data:ct},
    {name:'_rels/.rels', data:rels},
    {name:'xl/workbook.xml', data:wb},
    {name:'xl/_rels/workbook.xml.rels', data:wbRels},
    {name:'xl/worksheets/sheet1.xml', data:sheet}
  ]);
}

// ---------- public: matrix → csv Blob ----------
export function writeCsv(matrix){
  const esc=v=>{ const s=String(v==null?'':v); return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s; };
  return new Blob([matrix.map(r=>r.map(esc).join(',')).join('\n')],{type:'text/csv'});
}
