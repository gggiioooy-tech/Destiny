"""Generate the data-free site player from the offline analyzer's template."""
import importlib.util
import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('timeline', root/'tools/replay-analysis/analyze_local.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
html = module.HTML.replace('<meta charset="utf-8">', '<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data:; base-uri \'none\'; form-action \'none\'">')
source = '// Shared offline player template. Contains no battle data.\nconst template='+json.dumps(html, ensure_ascii=False)+';\n'
source += r"export function replayDocument(report){return template.replace('__DATA__',()=>JSON.stringify(report).replace(/</g,'\\u003c'));}"+'\n'
(root/'src/lib/replayTimelineTemplate.js').write_text(source, encoding='utf8')
