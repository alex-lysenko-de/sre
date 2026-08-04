import tkinter as tk
from tkinter import ttk
from pathlib import Path
from datetime import datetime

PROMPTS=Path("prompts")
HISTORY=PROMPTS/"history"
HISTORY.mkdir(parents=True,exist_ok=True)
MAP={
"Architect":"architect.txt",
"Developer":"developer.txt",
"Reviewer":"reviewer.txt",
"Fix":"fix.txt",
"Recheck":"recheck.txt",
"Commit":"commit.txt",
"Designer":"designer.txt"
}

history_files=[]
history_index=0
draft_text=""

def refresh_history():
    global history_files,history_index
    history_files=sorted(HISTORY.glob("*.txt"))
    history_index=len(history_files)
    update_status()

def update_status():
    if not history_files:
        status.set("History is empty")
    elif history_index>=len(history_files):
        status.set(f"New entry ({len(history_files)} saved)")
    else:
        status.set(f"History {history_index+1}/{len(history_files)}: {history_files[history_index].stem}")

def load():
    t=ticket.get().strip()
    f=PROMPTS/MAP[role.get()]
    txt=f.read_text(encoding="utf-8").replace("{{TICKET}}",t)
    out.delete("1.0","end")
    out.insert("1.0",txt)
    global history_index
    history_index=len(history_files)
    update_status()

def copy():
    r.clipboard_clear()
    r.clipboard_append(out.get("1.0","end-1c"))

def save_to_history():
    global draft_text
    text=out.get("1.0","end-1c")
    if not text.strip():
        return
    name=datetime.now().strftime("%Y%m%d_%H%M%S_%f")+".txt"
    (HISTORY/name).write_text(text,encoding="utf-8")
    refresh_history()
    draft_text=""

def history_prev():
    global history_index,draft_text
    if not history_files or history_index==0:
        return
    if history_index==len(history_files):
        draft_text=out.get("1.0","end-1c")
    history_index-=1
    out.delete("1.0","end")
    out.insert("1.0",history_files[history_index].read_text(encoding="utf-8"))
    update_status()

def history_next():
    global history_index
    if not history_files or history_index>=len(history_files):
        return
    history_index+=1
    out.delete("1.0","end")
    if history_index==len(history_files):
        out.insert("1.0",draft_text)
    else:
        out.insert("1.0",history_files[history_index].read_text(encoding="utf-8"))
    update_status()

r=tk.Tk()
r.title("AI Coordinator")
ttk.Label(r,text="Ticket").pack()
ticket=tk.StringVar(value="304")
ttk.Entry(r,textvariable=ticket).pack(fill="x")
role=tk.StringVar(value="Architect")
for k in MAP:
    ttk.Radiobutton(r,text=k,variable=role,value=k,command=load).pack(anchor="w")
out=tk.Text(r,width=90,height=25)
out.pack()
ttk.Button(r,text="Generate",command=load).pack(fill="x")
ttk.Button(r,text="Copy",command=copy).pack(fill="x")

ttk.Separator(r,orient="horizontal").pack(fill="x",pady=4)
ttk.Label(r,text="Custom prompts (history)").pack()
status=tk.StringVar()
ttk.Label(r,textvariable=status).pack()
hist_frame=ttk.Frame(r)
hist_frame.pack(fill="x")
ttk.Button(hist_frame,text="▲ Prev",command=history_prev).pack(side="left",expand=True,fill="x")
ttk.Button(hist_frame,text="▼ Next",command=history_next).pack(side="left",expand=True,fill="x")
ttk.Button(r,text="Save as new prompt",command=save_to_history).pack(fill="x")
r.bind("<Control-Up>",lambda e:history_prev())
r.bind("<Control-Down>",lambda e:history_next())

refresh_history()
load()
r.mainloop()
