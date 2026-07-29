export const conversations=[{
  uuid:'00000000-0000-4000-8000-000000000101',name:'Synthetic branching conversation',summary:'Synthetic fixture only',created_at:'2026-01-01T00:00:00Z',updated_at:'2026-01-01T00:04:00Z',chat_messages:[
    {uuid:'00000000-0000-4000-8000-000000000201',sender:'human',created_at:'2026-01-01T00:00:00Z',parent_message_uuid:'00000000-0000-4000-8000-000000000000',content:[{type:'text',text:'Explain the synthetic widget.'}]},
    {uuid:'00000000-0000-4000-8000-000000000202',sender:'assistant',created_at:'2026-01-01T00:01:00Z',parent_message_uuid:'00000000-0000-4000-8000-000000000201',content:[{type:'thinking',thinking:'Synthetic reasoning.'},{type:'text',text:'The synthetic widget is safe to test.'},{type:'tool_use',name:'show_widget',input:{code:'<div id="synthetic-artifact">Synthetic artifact</div>'}}]},
    {uuid:'00000000-0000-4000-8000-000000000203',sender:'assistant',created_at:'2026-01-01T00:02:00Z',parent_message_uuid:'00000000-0000-4000-8000-000000000201',content:[{type:'text',text:'Alternative synthetic answer.'}]},
    {uuid:'00000000-0000-4000-8000-000000000204',sender:'human',created_at:'2026-01-01T00:03:00Z',parent_message_uuid:'00000000-0000-4000-8000-000000000202',content:[{type:'text',text:'Continue with statistics and files.'}],attachments:[{file_name:'synthetic-note.txt',file_size:12}]},
    {uuid:'00000000-0000-4000-8000-000000000205',sender:'assistant',created_at:'2026-01-01T00:04:00Z',parent_message_uuid:'00000000-0000-4000-8000-000000000204',content:[{type:'text',text:'Synthetic analytics vocabulary: nebula nebula observatory.'}]}
  ]
}];

export const memories={global_memory:'Synthetic memory for CI only.'};
export const projects=[{uuid:'00000000-0000-4000-8000-000000000301',name:'Synthetic Project',description:'Synthetic project document'}];
export const design={uuid:'00000000-0000-4000-8000-000000000401',title:'Synthetic Design',project:{name:'CI Lab'},messages:[{role:'user',content:'Create a synthetic card.'},{role:'assistant',content:[{type:'thinking',thinking:'Synthetic design reasoning.'},{type:'text',text:'Synthetic design response.'}]}]};
