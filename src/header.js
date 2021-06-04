import stellar_logo from './stellar_logo_black.png';

export default function header(target) {
    const header = document.createElement('div');
    header.id = 'head';
    const img = new Image(71, 60);
    img.src = stellar_logo;
    header.appendChild(img);
    target.appendChild(header);

    const logo = document.createElement('div');
    logo.id = 'logo';
    target.appendChild(logo);
}
