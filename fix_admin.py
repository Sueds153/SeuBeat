with open('server/routes/admin.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the line "});" that ends the retry endpoint catch block (around line 1021)
# And the blank line after it (1022), then "router.post('/request/:id/force-voice'" (1023)
# We want to insert the new endpoint between line 1021 and 1023 (i.e., after line 1021)

# Let's find the exact position
insert_idx = None
for i in range(1015, 1030):
    if i < len(lines) and '});' in lines[i]:
        # Check if this is the retry endpoint closer by looking at previous lines
        context = ' '.join(lines[max(0,i-3):i+1])
        if 'logError' in context and 'Background Suno falhou no retry' in context:
            insert_idx = i + 1  # Insert after this line
            break

if insert_idx is None:
    print("Could not find insertion point, trying fallback...")
    # Just insert before the force-voice line
    for i, line in enumerate(lines):
        if 'router.post' in line and 'force-voice' in line and i > 1010:
            insert_idx = i
            break

if insert_idx:
    # The new endpoint code - using raw string to avoid escape issues
    new_code = """router.post('/request/:id/recover', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getAdminSupabase();
    if (!supabase) return res.status(500).json({ success: false, error: 'DB nao disponivel' });
    const { data: requestData } = await supabase.from('song_requests').select('*, songs(*)').eq('id', id).single();
    if (!requestData) return res.status(404).json({ success: false, error: 'Pedido nao encontrado' });
    const songData = firstRelated(requestData.songs);
    if (!songData) return res.status(400).json({ success: false, error: 'Música associada em falta.' });

    const knownTaskIds: string[] = [
      'f5ecb840034c7661a0c6f5b1868b7f44',
      '52d7f402a8cd806e7bd29796d23acb58',
      '6909cae212783daf684c2fe6db85fa87',
    ];

    logInfo('[Admin Recover] Iniciando recovery', { ourId: id });

    let foundAudioUrl: string | null = null;
    let usedTaskId: string | null = null;

    for (const taskId of knownTaskIds) {
      if (!taskId) continue;
      try {
        const result = await querySunoTask(taskId);
        if (result.audioUrl) {
          foundAudioUrl = result.audioUrl;
          usedTaskId = taskId;
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!foundAudioUrl) {
      return res.json({ success: false, error: 'Nenhuma task tem áudio.' });
    }

    // persist with skipProcessing
    const persistResult = await persistGeneratedSunoAudio(songData.id, usedTaskId, foundAudioUrl, {
      skipProcessing: true,
      hintDuration: songData.duration ?? 239,
    });

    // update song
    await supabase.from('songs').update({
      audio_url: persistResult.fullAudioUrl,
      full_song_url: persistResult.fullAudioUrl,
      preview_url: null,
      duration: persistResult.duration,
      mureka_task_id: usedTaskId,
      mureka_status: 'completed'
    }).eq('id', songData.id);

    return res.json({ success: true, message: 'Recovery OK' });
  } catch (err) {
    logRouteError(req, err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/request/:id/force-voice', adminAuth, async (req, res) => {
"""

    # Insert at the position
    new_lines = lines[:insert_idx] + [new_code] + lines[insert_idx:]
    
    with open('server/routes/admin.ts', 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    print(f"Successfully inserted new endpoint at line {insert_idx}, new file has {len(new_lines)} lines")
else:
    print("Could not find insertion point")