import {nodefs,writeChanged,readTextContent, fromChineseNumber,extractChineseNumber, toBase26} from 'ptk/nodebundle.cjs'; 
await nodefs; //export fs to global

const lines=readTextContent('xsq-raw.txt').replace(/\n\n/g,'\n').split(/\n/);

const cnumbertitle=/^ *([一二三四五六七八九十零]+ *)．/
let prevpage=0,page=0,vol='',ck='',samyutta='',anguttara='', 
fnpage='';

let nikayahandler;
const volumnstarts={
    1:'dn1',116:'dn2',271:'dn3',    
    398:'mn1', 597:'mn2',  830:'mn3',
    1013:'sn1',1207:'sn2', 1363:'sn3', 1555:'sn4', 1785:'sn5',    
    2065:'an1',2132:'an2', 2181:'an3', 2298:'an4',
    2454:'an5',2594:'an6', 2672:'an7', 2736:'an8',
    2815:'an9',2866:'an10',2993:'an11',
}

const out=[];
const tidy=text=>{
    return text.replace(/ *([“”]) */g,'$1').replace(/ *([‘’]) */g,'$1')
    .replace(/☉\n/g,'')//join next line
}
const tidybody=lines=>{
    return tidy(lines.join('\n').replace(/ *([^a-z\d]\d+) */g,(m,m1)=>'^f'+m1.trim()))
}
const tidyfootnote=lines=>{
    return tidy(lines.join('\n')
    .replace(/([hp]) ([āū])/g,'$1$2')
    .replace(/a ṭ/g,'aṭ')); //strange, excessive space added by foxit pdf to text
}
const writeVolumn=(v)=>{
    emitNote();
    out.push(paragraph);
    paragraph='';
    if (v=='an4') {
        while(out.length && !out[0].trim()) out.shift();
        out[0]='^bk#'+v+out[0];
        writeChanged('off/'+v+'.off',tidybody(out),true);
        writeChanged('off/'+v+'-footnote.tsv', tidyfootnote(footnotes),true);
        
    }
    footnotes.length=0;
    out.length=0;
}

const footnotes=[];
let paragraph='',noteparagraph='',notesection=false,fn='';
const emitNote=()=>{
    if (fnpage && noteparagraph) {
        footnotes.push([page,ck,noteparagraph]);
        noteparagraph='';    
    }
}
const emitParagraph=line=>{
    out.push(paragraph);
    paragraph=line.trim();
}
const addline=(line)=>{
    if (notesection) {
        noteparagraph+=line.trim();
    } else {
        if (line.startsWith('  ')) {
            emitParagraph(line);
        } else {
            paragraph+=line.trim();
        }
    }
}
const handler=(line)=>{
    const trimmed=line.trim();
    if (!trimmed || trimmed=='◆') return;
    const m=line.match(cnumbertitle);
    if (m) {
        const n=fromChineseNumber(m[1]);
        if (n) {
            emitParagraph('')
            let sutta='',vagga='';
            if (samyutta) {
                vagga=Math.floor(n/10);
                sutta=n-vagga*10;
                ck=vol[0]+ (samyutta?samyutta+toBase26(vagga)+sutta: n) ;
            } else if (anguttara){
                vagga='x';//need to resolve vagga from sutta number
                ck=vol[0]+anguttara+vagga+n
            } else {
                ck=vol[0]+n;
            }
            
            
            line=trimmed.replace(m[1],'\n^ck#'+ck+'【'+m[1].replace(/ +/g,''))+'】';
        }
    } 
    const m2=line.match(/\d+\./);
    const n=parseInt(line);
    if (n) { //paranum or foot note
        if (trimmed==n.toString()) {//pure end page marker ,ignore
            line=''
        } else {
            if (m2) {
                line=line.replace(/(\d+)\./,'^m$1');
            } else if (~line.indexOf(n+' ')){//footnote marker
                notesection=true;
                emitNote();
                fnpage=page;
                fn=n;
            }
        }
    }
    
    addline(line);
}

const snhandler=(line)=>{
    const m=line.match(/^相應部．/);
    if (m) {
        const till=line.lastIndexOf('．');
        samyutta=fromChineseNumber(line.slice(4,till));
        line='^ck#s'+samyutta+line.slice(till+1).replace(/ +蕭式球譯 */,'')+'☉'
    }
    return handler(line)
}
const anhandler=(line)=>{
    const m=line.match(/^增支部．/);
    if (m) {
        const till=line.lastIndexOf('集');
        anguttara=fromChineseNumber(line.slice(5,till));
        line='^ck#a'+anguttara+line.slice(till+1).replace(/ +蕭式球譯 */,'')+'☉'
    }
    return handler(line)
}


const nikayaHandlers={
    's':snhandler,
    'd':handler,
    'm':handler,
    'a':anhandler,
}
let prevvol='',i=0;
while (i<lines.length) {
    const line=lines[i];
    const mpage=(line.match(/Page (\d+)/));
    if (mpage) {
        page=parseInt(mpage[1]);
        if(prevpage+1!==page) {
            console.log('page gap',i,page)
        }
        if (volumnstarts[page]) {
            vol=volumnstarts[page];
            nikayahandler=nikayaHandlers[vol[0]];
            if (vol[0]!=='s') samyutta='';
            if (vol[0]!=='a') anguttara='';
            if (prevvol!==vol && prevvol) writeVolumn(prevvol);
            prevvol=vol;
            if (vol=='sn1' || vol=='an1') {
                //sn1 相應部 marker 和 作者放一起，不能跳過
            } else {
                i++;//skip the author signature
            }
            emitNote();
        }
        notesection=false;
        prevpage=page;
    } else {
        nikayahandler(line);
    }
    i++;
}