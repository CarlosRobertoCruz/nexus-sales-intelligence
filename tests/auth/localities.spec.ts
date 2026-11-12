import { test, expect, type Page } from "@playwright/test";
import { classifyCommercialRows } from "../../src/apps/importacao/domain/classifyCommercialRows";
import type { SpreadsheetCell } from "../../src/apps/importacao/types/spreadsheetImport";

const sheet=(rows:Record<string,SpreadsheetCell>[])=>{
  const headers=[...new Set(rows.flatMap(Object.keys))];
  return {fileName:"teste-localidades",rows:[headers,...rows.map(row=>headers.map(key=>row[key]??null))]};
};
async function openMap(page:Page) {
  const attendance=Array.from({length:91},(_,index)=>({
    id_atendimento:String(100+index),protocolo:String(202510010000+index),codigo_cliente:String(1000+index),
    nome_razaosocial:`Cliente fictício ${index}`,data_cadastro:"01/10/2025",descricao_abertura:"Instalação 600 Mega Combo Plus",
    usuario_abertura:"Beatriz",status:"Resolvido",tipo_atendimento:"INSTALAÇÃO",
  }));
  const orders=attendance.map((row,index)=>({id_ordem_servico:String(500+index),numero_ordem_servico:String(500+index),
    id_atendimento:row.id_atendimento,codigo_cliente:row.codigo_cliente,tipo_ordem_servico:"INSTALAÇÃO",status:"Finalizado",
    data_inicio_programado:"02/10/2025 09:00",data_inicio_executado:"02/10/2025 09:00",data_termino_executado:"02/10/2025 10:00",
    bairro:index===0?"Cachoeira":"",
  }));
  const c=classifyCommercialRows(sheet(attendance),sheet(orders));
  const ledger={version:1,attendance:c.attendance,serviceOrders:c.serviceOrders,sales:c.sales,renewals:[],cancellations:[],reactivations:[]};
  const errors:string[]=[];
  page.on("pageerror",error=>errors.push(error.message));
  page.on("console",message=>{if(message.type()==="error")errors.push(message.text());});
  await page.route("https://tile.openstreetmap.org/**",route=>route.fulfill({contentType:"image/png",body:Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGPonNb7HwAGBAKskcj5rwAAAABJRU5ErkJggg==","base64")} ));
  await page.route("**/api/**",route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==="/api/session")return route.fulfill({json:{user:{name:"Teste",email:"teste@example.invalid"}}});
    if(path==="/api/data")return route.fulfill({json:{ledger}});
    throw new Error(`API inesperada: ${path}`);
  });
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto("/");
  await expect(page.getByText("Visão geral de vendas",{exact:true})).toBeVisible({timeout:15000});
  await page.getByRole("navigation",{name:"Navegação principal"}).getByRole("button",{name:"Localidades",exact:true}).click();
  await expect(page.getByText("Mapa por localidade",{exact:true})).toBeVisible();
  return errors;
}

test("mapa preserva 91 vendas, mostra só o bairro comprovado e muda para métrica sem pontos",async({page})=>{
  const errors=await openMap(page);
  const indicators=page.locator('[aria-label="Indicadores geográficos"]');
  await expect(indicators.getByText("91",{exact:true})).toBeVisible();
  await expect(indicators.getByText("Muriqui",{exact:true})).toBeVisible();
  await expect(page.getByText("90 sem localidade identificada",{exact:true})).toBeVisible();
  await expect(page.getByText("1 de 91 vendas representados por referências regionais aproximadas.")).toBeVisible();
  await expect(page.locator(".commercial-map-marker")).toHaveCount(1);
  await expect(page.getByRole("button",{name:"Muriqui: 1 vendas",exact:true})).toBeVisible();
  await expect(page.getByText("Localidade não informada",{exact:true})).toHaveCount(0);
  await page.screenshot({path:"test-results/localities-desktop.png",fullPage:true});
  await page.getByRole("combobox",{name:"Métrica exibida no mapa"}).click();
  await page.getByRole("option",{name:"Renovações",exact:true}).click();
  await expect(page.locator(".commercial-map-marker")).toHaveCount(0);
  await expect(page.getByText("Nenhuma localidade identificada no período selecionado.")).toBeVisible();
  expect(errors).toEqual([]);
});

test("mapa e avisos cabem no celular",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  const errors=await openMap(page);
  await expect(page.getByText("90 sem localidade identificada")).toBeVisible();
  const map=page.locator(".commercial-map");
  const box=await map.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x+box!.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:"test-results/localities-mobile.png",fullPage:true});
  expect(errors).toEqual([]);
});
