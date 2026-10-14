/* Reducir ruido constante de un audio (siseo, ventilador, zumbido) con afftdn + filtro de graves. */
(function () {
  'use strict';
  const M = window.FFmpegMotor;
  const S = window.Suite;
  const nivel = document.getElementById('nivel');
  const graves = document.getElementById('graves');

  M.montar({
    aceptar: M.esMedio,
    mensajeVacio: 'Elige un audio (MP3, WAV, M4A, OGG…) o un video.',
    comando({ archivos, infos }) {
      return {
        args: async (e, ayudas) => {
          // El piso de ruido se mide en la propia grabación: el 10 % de tramos de 0,1 s más silenciosos.
          const lineas = await ayudas.registro(['-i', e[0], '-vn', '-af',
            'aformat=channel_layouts=mono,asetnsamples=n=4410,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level',
            '-f', 'null', '-'], /lavfi\.astats\.Overall\.RMS_level=/);
          const niveles = lineas.map((l) => Number(l.split('=').pop())).filter((x) => Number.isFinite(x) && x > -90).sort((a, b) => a - b);
          const piso = niveles.length ? niveles[Math.floor(niveles.length * 0.1)] : -60;
          const nf = Math.max(-75, Math.min(-20, Math.round(piso - 2)));
          const partes = [];
          if (graves.checked) partes.push('highpass=f=80');
          partes.push(`afftdn=nr=${nivel.value}:nf=${nf}`);
          return ['-i', e[0], '-vn', '-af', partes.join(','), '-c:a', 'libmp3lame', '-b:a', '192k', 'salida.mp3'];
        },
        salida: 'salida.mp3',
        mime: 'audio/mpeg',
        nombre: `${S.nombreBase(archivos[0].name, 'audio')}-sin-ruido.mp3`,
        duracion: infos[0].duracion,
        aviso: () => 'Escucha el resultado entero: si la voz suena metálica o «sumergida», baja a un nivel más suave.',
      };
    },
  });
})();
