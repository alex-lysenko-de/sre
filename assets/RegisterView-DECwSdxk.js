import{h,g as B,a as f,i as M,j as y,k as o,l as k,m as n,w as j,n as w,p as b,v as C,c as L,t as _,o as g}from"./vue-vendor-C77FZFBx.js";import{u as U}from"./index-C8xB7GOY.js";import"./supabase-D4wOtLzw.js";/**
 * @license lucide-vue-next v0.544.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const A=e=>e.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase(),N=e=>e.replace(/^([A-Z])|[\s-_]+(\w)/g,(t,l,r)=>r?r.toUpperCase():l.toLowerCase()),$=e=>{const t=N(e);return t.charAt(0).toUpperCase()+t.slice(1)},R=(...e)=>e.filter((t,l,r)=>!!t&&t.trim()!==""&&r.indexOf(t)===l).join(" ").trim(),V=e=>e==="";/**
 * @license lucide-vue-next v0.544.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */var d={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor","stroke-width":2,"stroke-linecap":"round","stroke-linejoin":"round"};/**
 * @license lucide-vue-next v0.544.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const q=({name:e,iconNode:t,absoluteStrokeWidth:l,"absolute-stroke-width":r,strokeWidth:a,"stroke-width":u,size:i=d.width,color:m=d.stroke,...p},{slots:c})=>h("svg",{...d,...p,width:i,height:i,stroke:m,"stroke-width":V(l)||V(r)||l===!0||r===!0?Number(a||u||d["stroke-width"])*24/Number(i):a||u||d["stroke-width"],class:R("lucide",p.class,...e?[`lucide-${A($(e))}-icon`,`lucide-${A(e)}`]:["lucide-icon"])},[...t.map(s=>h(...s)),...c.default?[c.default()]:[]]);/**
 * @license lucide-vue-next v0.544.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const v=(e,t)=>(l,{slots:r,attrs:a})=>h(q,{...a,...l,iconNode:t,name:e},r);/**
 * @license lucide-vue-next v0.544.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const z=v("key-round",[["path",{d:"M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z",key:"1s6t7t"}],["circle",{cx:"16.5",cy:"7.5",r:".5",fill:"currentColor",key:"w0ekpg"}]]);/**
 * @license lucide-vue-next v0.544.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const D=v("loader-circle",[["path",{d:"M21 12a9 9 0 1 1-6.219-8.56",key:"13zald"}]]);/**
 * @license lucide-vue-next v0.544.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const E=v("user",[["path",{d:"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2",key:"975kel"}],["circle",{cx:"12",cy:"7",r:"4",key:"17ys0d"}]]),I={class:"flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4"},T={class:"bg-white shadow-lg rounded-2xl p-8 w-full max-w-sm"},Z={class:"flex flex-col items-center mb-6"},H={class:"flex items-center gap-2"},O=["disabled"],P={key:0,class:"text-red-600 text-sm text-center mt-2"},S={key:1,class:"text-green-600 text-sm text-center mt-2"},K=B({__name:"RegisterView",setup(e){const t=f(""),l=f(""),r=f(!1),{register:a,initialize:u,isLoading:i,error:m}=U();M(()=>{u()});async function p(){try{r.value=!1,await a(l.value.trim(),t.value.trim()),r.value=!0}catch(c){console.error(c)}}return(c,s)=>(g(),y("div",I,[o("div",T,[o("div",Z,[k(n(E),{class:"w-12 h-12 text-indigo-600 mb-2"}),s[2]||(s[2]=o("h1",{class:"text-2xl font-semibold text-gray-800"},"Регистрация",-1)),s[3]||(s[3]=o("p",{class:"text-gray-500 text-sm text-center mt-1"}," Создайте учётную запись через WebAuthn ",-1))]),o("form",{onSubmit:j(p,["prevent"]),class:"space-y-4"},[o("div",null,[s[4]||(s[4]=o("label",{class:"block text-sm font-medium text-gray-700 mb-1"}," Ваше имя ",-1)),b(o("input",{"onUpdate:modelValue":s[0]||(s[0]=x=>t.value=x),type:"text",required:"",placeholder:"Иван Иванов",class:"w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"},null,512),[[C,t.value]])]),o("div",null,[s[5]||(s[5]=o("label",{class:"block text-sm font-medium text-gray-700 mb-1"}," Инвайт-токен ",-1)),o("div",H,[k(n(z),{class:"w-5 h-5 text-gray-400"}),b(o("input",{"onUpdate:modelValue":s[1]||(s[1]=x=>l.value=x),type:"text",required:"",placeholder:"Введите токен",class:"w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"},null,512),[[C,l.value]])])]),o("button",{type:"submit",disabled:n(i),class:"w-full flex justify-center items-center gap-2 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"},[n(i)?(g(),L(n(D),{key:0,class:"w-5 h-5 animate-spin text-white"})):w("",!0),o("span",null,_(n(i)?"Регистрация...":"Зарегистрироваться"),1)],8,O),n(m)?(g(),y("p",P,_(n(m)),1)):w("",!0),r.value?(g(),y("p",S," Регистрация успешна! 🎉 ")):w("",!0)],32)])]))}});export{K as default};
