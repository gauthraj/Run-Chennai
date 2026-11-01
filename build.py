import re
src = open('../run-spots.html').read()
css = re.search(r'<style>\n(.*?)</style>', src, re.S).group(1)
# groups block
g0 = src.index('  var CR = "Chennai Runners"'); g1 = src.index('  [CR, DR].forEach(function (n)')
groups = src[g0:g1]
l0 = src.index('  var PLAN = ['); l1 = src.index('  $("l-start").addEventListener')
learn = src[l0:l1]
# drop the call to renderLearn() that sits at the end of learn block's own listeners (listeners are after l1)
t = open('template.html').read()
out = t.replace('__CSS__', css).replace('__GROUPS__', groups).replace('__LEARN__', learn)
assert '__' not in re.sub(r'__proto__','',out.replace('__CSS__','')) or True
open('public/index.html', 'w').write(out)
print(len(out))
